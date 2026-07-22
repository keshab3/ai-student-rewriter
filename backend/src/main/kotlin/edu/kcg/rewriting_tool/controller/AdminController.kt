package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.AdminAuditLogResponse
import edu.kcg.rewriting_tool.dto.AdminSessionResponse
import edu.kcg.rewriting_tool.dto.PromptSettingResponse
import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.dto.UpdatePromptSettingRequest
import edu.kcg.rewriting_tool.service.AdminAuditService
import edu.kcg.rewriting_tool.service.PromptSettingsService
import jakarta.validation.Valid
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin")
class AdminController(
    private val promptSettingsService: PromptSettingsService,
    private val adminAuditService: AdminAuditService,
) {
    @GetMapping("/me")
    fun me(authentication: Authentication): AdminSessionResponse =
        AdminSessionResponse(
            username = authentication.name ?: "unknown",
            roles = authentication.authorities
                .mapNotNull { authority ->
                    authority.authority
                        ?.takeIf { it.startsWith("ROLE_") }
                        ?.removePrefix("ROLE_")
                }
                .sorted(),
        )

    @GetMapping("/prompt-settings")
    fun listPromptSettings(): List<PromptSettingResponse> =
        promptSettingsService.listSettings()

    @PutMapping("/prompt-settings/{mode}")
    fun updatePromptSetting(
        @PathVariable mode: RewriteMode,
        @Valid @RequestBody request: UpdatePromptSettingRequest,
        authentication: Authentication,
    ): PromptSettingResponse {
        val updated = promptSettingsService.updateSetting(mode, request)
        adminAuditService.recordPromptSettingUpdate(authentication.name ?: "unknown", mode)
        return updated
    }

    @GetMapping("/audit-logs")
    fun listAuditLogs(): List<AdminAuditLogResponse> =
        adminAuditService.listRecent()
}
