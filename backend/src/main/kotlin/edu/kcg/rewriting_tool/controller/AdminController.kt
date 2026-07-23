package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.AdminAuditLogResponse
import edu.kcg.rewriting_tool.dto.AdminCreateUserRequest
import edu.kcg.rewriting_tool.dto.AdminSessionResponse
import edu.kcg.rewriting_tool.dto.AdminUpdateUserRequest
import edu.kcg.rewriting_tool.dto.AdminUserResponse
import edu.kcg.rewriting_tool.dto.PromptSettingResponse
import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.dto.UpdatePromptSettingRequest
import edu.kcg.rewriting_tool.service.AdminAuditService
import edu.kcg.rewriting_tool.service.PromptSettingsService
import edu.kcg.rewriting_tool.service.UserAccountService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin")
class AdminController(
    private val promptSettingsService: PromptSettingsService,
    private val adminAuditService: AdminAuditService,
    private val userAccountService: UserAccountService,
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

    @GetMapping("/users")
    fun listUsers(): List<AdminUserResponse> =
        userAccountService.listUsersForAdmin()

    @PostMapping("/users")
    fun createUser(
        @Valid @RequestBody request: AdminCreateUserRequest,
        authentication: Authentication,
    ): AdminUserResponse {
        val created = userAccountService.createUserForAdmin(request)
        adminAuditService.recordUserCreated(authentication.name ?: "unknown", created.username)
        return created
    }

    @PutMapping("/users/{id}")
    fun updateUser(
        @PathVariable id: Long,
        @Valid @RequestBody request: AdminUpdateUserRequest,
        authentication: Authentication,
    ): AdminUserResponse {
        val updated = userAccountService.updateUserForAdmin(id, request, authentication.name ?: "unknown")
        adminAuditService.recordUserUpdated(authentication.name ?: "unknown", updated.username)
        return updated
    }

    @DeleteMapping("/users/{id}")
    fun deleteUser(
        @PathVariable id: Long,
        authentication: Authentication,
    ): ResponseEntity<Void> {
        val deleted = userAccountService.deleteUserForAdmin(id, authentication.name ?: "unknown")
        adminAuditService.recordUserDeleted(authentication.name ?: "unknown", deleted.username)
        return ResponseEntity.noContent().build()
    }
}
