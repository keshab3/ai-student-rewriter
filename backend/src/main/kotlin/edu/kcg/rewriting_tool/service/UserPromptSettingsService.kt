package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.dto.UpdateUserPromptSettingRequest
import edu.kcg.rewriting_tool.dto.UserPromptSettingResponse
import edu.kcg.rewriting_tool.entity.PromptSetting
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.entity.UserPromptSetting
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import edu.kcg.rewriting_tool.repository.UserPromptSettingRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class UserPromptSettingsService(
    private val userAccountRepository: UserAccountRepository,
    private val userPromptSettingRepository: UserPromptSettingRepository,
    private val promptSettingsService: PromptSettingsService,
) {
    @Transactional(readOnly = true)
    fun listSettings(username: String): List<UserPromptSettingResponse> {
        val owner = loadOwner(username)
        val overrides = userPromptSettingRepository.findAllByOwner(owner).associateBy { it.mode }

        return promptSettingsService.listSettings().map { defaultSetting ->
            val override = overrides[defaultSetting.mode]
            UserPromptSettingResponse(
                mode = defaultSetting.mode,
                label = defaultSetting.label,
                description = defaultSetting.description,
                promptInstruction = override?.promptInstruction?.takeIf { it.isNotBlank() }
                    ?: defaultSetting.promptInstruction,
                outputInstruction = override?.outputInstruction?.takeIf { it.isNotBlank() }
                    ?: defaultSetting.outputInstruction,
                defaultPromptInstruction = defaultSetting.promptInstruction,
                defaultOutputInstruction = defaultSetting.outputInstruction,
                customized = override != null,
                updatedAt = override?.updatedAt ?: defaultSetting.updatedAt,
            )
        }
    }

    @Transactional
    fun updateSetting(
        username: String,
        mode: RewriteMode,
        request: UpdateUserPromptSettingRequest,
    ): UserPromptSettingResponse {
        val owner = loadOwner(username)
        val defaultSetting = promptSettingsService.getSetting(mode)
        val saved = userPromptSettingRepository.findByOwnerAndMode(owner, mode)
            ?: UserPromptSetting(owner = owner, mode = mode)

        saved.promptInstruction = request.promptInstruction.trim()
        saved.outputInstruction = request.outputInstruction.trim()
        saved.updatedAt = LocalDateTime.now()

        return toResponse(defaultSetting, userPromptSettingRepository.save(saved))
    }

    @Transactional(readOnly = true)
    fun getEffectiveSetting(username: String, mode: RewriteMode): PromptSetting {
        val owner = loadOwner(username)
        val defaultSetting = promptSettingsService.getEnabledSetting(mode)
        val override = userPromptSettingRepository.findByOwnerAndMode(owner, mode)

        return PromptSetting(
            mode = defaultSetting.mode,
            label = defaultSetting.label,
            description = defaultSetting.description,
            promptInstruction = override?.promptInstruction?.takeIf { it.isNotBlank() }
                ?: defaultSetting.promptInstruction,
            outputInstruction = override?.outputInstruction?.takeIf { it.isNotBlank() }
                ?: defaultSetting.outputInstruction,
            enabled = defaultSetting.enabled,
            updatedAt = override?.updatedAt ?: defaultSetting.updatedAt,
        )
    }

    private fun toResponse(
        defaultSetting: PromptSetting,
        override: UserPromptSetting,
    ): UserPromptSettingResponse =
        UserPromptSettingResponse(
            mode = defaultSetting.mode,
            label = defaultSetting.label,
            description = defaultSetting.description,
            promptInstruction = override.promptInstruction?.takeIf { it.isNotBlank() }
                ?: defaultSetting.promptInstruction,
            outputInstruction = override.outputInstruction?.takeIf { it.isNotBlank() }
                ?: defaultSetting.outputInstruction
                ?: promptSettingsService.defaultOutputInstruction(),
            defaultPromptInstruction = defaultSetting.promptInstruction,
            defaultOutputInstruction = defaultSetting.outputInstruction
                ?: promptSettingsService.defaultOutputInstruction(),
            customized = true,
            updatedAt = override.updatedAt,
        )

    private fun loadOwner(username: String): UserAccount =
        userAccountRepository.findByUsername(username.trim())
            ?: throw UserAccountNotFoundException(username)
}
