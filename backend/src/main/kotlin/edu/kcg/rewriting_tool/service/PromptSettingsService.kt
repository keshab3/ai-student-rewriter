package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.PromptSettingResponse
import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.dto.RewriteModeResponse
import edu.kcg.rewriting_tool.dto.UpdatePromptSettingRequest
import edu.kcg.rewriting_tool.entity.PromptSetting
import edu.kcg.rewriting_tool.repository.PromptSettingRepository
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class PromptSettingsService(
    private val promptSettingRepository: PromptSettingRepository,
) {
    @EventListener(ApplicationReadyEvent::class)
    @Transactional
    fun initializeDefaults() {
        ensureDefaults()
    }

    @Transactional
    fun listSettings(): List<PromptSettingResponse> =
        listSettingEntities().map { it.toResponse() }

    @Transactional
    fun listEnabledModes(): List<RewriteModeResponse> =
        listSettingEntities()
            .filter { it.enabled }
            .map { setting ->
                RewriteModeResponse(
                    value = setting.mode,
                    label = setting.label,
                    description = setting.description,
                )
            }

    @Transactional
    fun getSetting(mode: RewriteMode): PromptSetting {
        ensureDefaults()
        return promptSettingRepository.findById(mode).orElseGet {
            promptSettingRepository.save(defaultSetting(mode))
        }
    }

    @Transactional
    fun getEnabledSetting(mode: RewriteMode): PromptSetting {
        val setting = getSetting(mode)
        if (!setting.enabled) {
            throw RewriteModeUnavailableException(mode)
        }
        return setting
    }

    @Transactional
    fun updateSetting(mode: RewriteMode, request: UpdatePromptSettingRequest): PromptSettingResponse {
        val setting = getSetting(mode)
        setting.label = request.label.trim()
        setting.description = request.description.trim()
        setting.promptInstruction = request.promptInstruction.trim()
        setting.outputInstruction = request.outputInstruction.trim()
        setting.enabled = request.enabled
        setting.updatedAt = LocalDateTime.now()
        return promptSettingRepository.save(setting).toResponse()
    }

    private fun listSettingEntities(): List<PromptSetting> {
        ensureDefaults()
        return promptSettingRepository
            .findAll()
            .sortedBy { RewriteMode.entries.indexOf(it.mode) }
    }

    private fun ensureDefaults() {
        RewriteMode.entries.forEach { mode ->
            if (!promptSettingRepository.existsById(mode)) {
                promptSettingRepository.save(defaultSetting(mode))
            }
        }
    }

    private fun defaultSetting(mode: RewriteMode): PromptSetting =
        PromptSetting(
            mode = mode,
            label = mode.label,
            description = mode.description,
            promptInstruction = mode.defaultPromptInstruction(),
            outputInstruction = defaultOutputInstruction(),
            enabled = true,
            updatedAt = LocalDateTime.now(),
        )

    private fun PromptSetting.toResponse(): PromptSettingResponse =
        PromptSettingResponse(
            mode = mode,
            label = label,
            description = description,
            promptInstruction = promptInstruction,
            outputInstruction = outputInstruction?.takeIf { it.isNotBlank() } ?: defaultOutputInstruction(),
            enabled = enabled,
            updatedAt = updatedAt,
        )

    fun defaultOutputInstruction(): String =
        "Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text."

    private fun RewriteMode.defaultPromptInstruction(): String =
        when (this) {
            RewriteMode.GRAMMAR_FIX ->
                "Fix grammar only. Keep the same meaning and English level."
            RewriteMode.ACADEMIC_REWRITE ->
                "Use formal academic wording. Keep the same facts and order."
            RewriteMode.SIMPLE_REWRITE ->
                "Use easier English and clear sentences. Keep the same meaning."
            RewriteMode.SHORTER_VERSION ->
                "Keep only the main points. Remove repeated words."
            RewriteMode.LONGER_VERSION ->
                "Add clear detail from the original idea only. Do not invent facts."
            RewriteMode.PARAPHRASE ->
                "Use different wording and sentence structure. Keep the same idea."
            RewriteMode.LEVEL_1_ADVANCED ->
                "C1-C2. Advanced neutral student writing with precise vocabulary."
            RewriteMode.LEVEL_2_CLEAR ->
                "B2-C1. Clear academic student writing with readable sentences."
            RewriteMode.LEVEL_3_NATURAL ->
                "B1-B2. Natural student tone with common academic words."
            RewriteMode.LEVEL_4_SIMPLE ->
                "A2-B1. Simple student English with short to medium sentences."
            RewriteMode.LEVEL_5_BASIC ->
                "A1-A2. Basic student English with common words and short sentences."
        }
}
