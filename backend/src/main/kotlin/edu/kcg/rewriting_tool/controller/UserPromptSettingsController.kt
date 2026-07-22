package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.dto.UpdateUserPromptSettingRequest
import edu.kcg.rewriting_tool.dto.UserPromptSettingResponse
import edu.kcg.rewriting_tool.service.UserPromptSettingsService
import jakarta.validation.Valid
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/user/prompt-settings")
class UserPromptSettingsController(
    private val userPromptSettingsService: UserPromptSettingsService,
) {
    @GetMapping
    fun listPromptSettings(authentication: Authentication): List<UserPromptSettingResponse> =
        userPromptSettingsService.listSettings(authentication.name ?: "")

    @PutMapping("/{mode}")
    fun updatePromptSetting(
        authentication: Authentication,
        @PathVariable mode: RewriteMode,
        @Valid @RequestBody request: UpdateUserPromptSettingRequest,
    ): UserPromptSettingResponse =
        userPromptSettingsService.updateSetting(authentication.name ?: "", mode, request)
}
