package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.RewriteModeResponse
import edu.kcg.rewriting_tool.dto.RewriteRequest
import edu.kcg.rewriting_tool.dto.RewriteResponse
import edu.kcg.rewriting_tool.dto.RewriteStatsResponse
import edu.kcg.rewriting_tool.dto.RewriteEvaluationResponse
import edu.kcg.rewriting_tool.dto.UpdateRewriteRequest
import edu.kcg.rewriting_tool.entity.PromptSetting
import edu.kcg.rewriting_tool.entity.RewriteHistory
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.repository.RewriteHistoryRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

@Service
class RewriteService(
    private val repository: RewriteHistoryRepository,
    private val userAccountRepository: UserAccountRepository,
    private val aiRewriteClient: AiRewriteClient,
    private val promptSettingsService: PromptSettingsService,
    private val userPromptSettingsService: UserPromptSettingsService,
    private val vocabularySuggestionService: VocabularySuggestionService,
    private val rewriteConstraintService: RewriteConstraintService,
    private val rewriteEvaluationService: RewriteEvaluationService,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun createRewrite(username: String, request: RewriteRequest): RewriteResponse {
        val owner = loadOwner(username)
        val originalText = request.text.trim()
        val avoidWords = rewriteConstraintService.normalizeAvoidWords(request.avoidWords)
        val vocabularySuggestions = vocabularySuggestionService.collectSuggestions(originalText)
        val promptSetting = userPromptSettingsService
            .getEffectiveSetting(username, request.mode)
            .withRequestOverrides(request.promptInstruction, request.outputInstruction)
        val rewrittenText = aiRewriteClient.rewrite(
            text = originalText,
            mode = request.mode,
            promptSetting = promptSetting,
            vocabularySuggestions = vocabularySuggestions,
            avoidWords = avoidWords,
        )
        val evaluation = rewriteEvaluationService.evaluate(originalText, rewrittenText, request.mode, avoidWords)
        val saved = repository.save(
            RewriteHistory(
                originalText = originalText,
                rewrittenText = rewrittenText,
                vocabularySuggestionsJson = encode(vocabularySuggestions),
                avoidWordsJson = encode(avoidWords),
                evaluationJson = encode(evaluation),
                mode = request.mode,
                createdAt = LocalDateTime.now(),
                owner = owner,
            ),
        )

        return saved.toResponse(promptSetting.label)
    }

    @Transactional(readOnly = true)
    fun previewRewrite(request: RewriteRequest): RewriteResponse {
        val originalText = request.text.trim()
        val avoidWords = rewriteConstraintService.normalizeAvoidWords(request.avoidWords)
        val vocabularySuggestions = vocabularySuggestionService.collectSuggestions(originalText)
        val promptSetting = promptSettingsService
            .getEnabledSetting(request.mode)
            .withRequestOverrides(request.promptInstruction, request.outputInstruction)
        val rewrittenText = aiRewriteClient.rewrite(
            text = originalText,
            mode = request.mode,
            promptSetting = promptSetting,
            vocabularySuggestions = vocabularySuggestions,
            avoidWords = avoidWords,
        )
        val matchedAvoidWords = rewriteConstraintService.findAvoidedTerms(rewrittenText, avoidWords)
        val evaluation = rewriteEvaluationService.evaluate(originalText, rewrittenText, request.mode, avoidWords)

        return RewriteResponse(
            id = 0,
            originalText = originalText,
            rewrittenText = rewrittenText,
            mode = request.mode,
            modeLabel = promptSetting.label,
            vocabularySuggestions = vocabularySuggestions,
            avoidWords = avoidWords,
            matchedAvoidWords = matchedAvoidWords,
            evaluation = evaluation,
            createdAt = LocalDateTime.now(),
        )
    }

    @Transactional(readOnly = true)
    fun listRewrites(username: String): List<RewriteResponse> {
        val owner = loadOwner(username)
        return repository.findAllByOwnerOrderByCreatedAtDesc(owner).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getRewrite(username: String, id: Long): RewriteResponse {
        val owner = loadOwner(username)
        return repository.findByIdAndOwner(id, owner).orElseThrow { RewriteNotFoundException(id) }.toResponse()
    }

    @Transactional
    fun updateRewrite(username: String, id: Long, request: UpdateRewriteRequest): RewriteResponse {
        val owner = loadOwner(username)
        val rewrite = repository.findByIdAndOwner(id, owner).orElseThrow { RewriteNotFoundException(id) }
        val promptSetting = promptSettingsService.getEnabledSetting(request.mode)
        val existingAvoidWords = decodeList(rewrite.avoidWordsJson)
        val existingVocabularySuggestions = decodeSuggestions(rewrite.vocabularySuggestionsJson)
        val avoidWords = rewriteConstraintService.normalizeAvoidWords(request.avoidWords ?: existingAvoidWords)
        val vocabularySuggestions = request.vocabularySuggestions ?: existingVocabularySuggestions
        val evaluation = rewriteEvaluationService.evaluate(
            request.originalText.trim(),
            request.rewrittenText.trim(),
            request.mode,
            avoidWords,
        )
        rewrite.originalText = request.originalText.trim()
        rewrite.rewrittenText = request.rewrittenText.trim()
        rewrite.vocabularySuggestionsJson = encode(vocabularySuggestions)
        rewrite.avoidWordsJson = encode(avoidWords)
        rewrite.evaluationJson = encode(evaluation)
        rewrite.mode = request.mode
        return repository.save(rewrite).toResponse(promptSetting.label)
    }

    @Transactional
    fun deleteRewrite(username: String, id: Long) {
        val owner = loadOwner(username)
        if (!repository.existsByIdAndOwner(id, owner)) {
            throw RewriteNotFoundException(id)
        }
        repository.deleteById(id)
    }

    @Transactional(readOnly = true)
    fun getStats(username: String): RewriteStatsResponse {
        val owner = loadOwner(username)
        val recent = repository.findAllByOwnerOrderByCreatedAtDesc(owner).take(5).map { it.toResponse() }
        return RewriteStatsResponse(
            totalRewrites = repository.countByOwner(owner),
            recentRewrites = recent,
        )
    }

    fun listModes(): List<RewriteModeResponse> =
        promptSettingsService.listEnabledModes()

    private fun PromptSetting.withRequestOverrides(
        promptInstruction: String?,
        outputInstruction: String?,
    ): PromptSetting =
        PromptSetting(
            mode = mode,
            label = label,
            description = description,
            promptInstruction = promptInstruction?.trim()?.takeIf { it.isNotBlank() } ?: this.promptInstruction,
            outputInstruction = outputInstruction?.trim()?.takeIf { it.isNotBlank() } ?: this.outputInstruction,
            enabled = enabled,
            updatedAt = updatedAt,
        )

    private fun RewriteHistory.toResponse(modeLabel: String = promptSettingsService.getSetting(mode).label): RewriteResponse {
        val avoidWords = decodeList(avoidWordsJson)
        val evaluation = decodeEvaluation(evaluationJson)
        return RewriteResponse(
            id = requireNotNull(id),
            originalText = originalText,
            rewrittenText = rewrittenText,
            mode = mode,
            modeLabel = modeLabel,
            vocabularySuggestions = decodeSuggestions(vocabularySuggestionsJson),
            avoidWords = avoidWords,
            matchedAvoidWords = rewriteConstraintService.findAvoidedTerms(rewrittenText, avoidWords),
            evaluation = evaluation,
            createdAt = createdAt,
        )
    }

    private fun loadOwner(username: String): UserAccount =
        userAccountRepository.findByUsername(username.trim())
            ?: throw UserAccountNotFoundException(username)

    private fun encode(value: Any): String =
        objectMapper.writeValueAsString(value)

    private fun decodeSuggestions(json: String?): Map<String, List<String>> =
        runCatching {
            val root = objectMapper.readTree(json?.takeIf { it.isNotBlank() } ?: "{}")
            if (!root.isObject) {
                emptyMap()
            } else {
                buildMap {
                    root.properties().forEach { entry ->
                        val values = buildList {
                            entry.value.forEach { item ->
                                val suggestion = item.asString("").trim()
                                if (suggestion.isNotBlank()) {
                                    add(suggestion)
                                }
                            }
                        }
                        if (values.isNotEmpty()) {
                            put(entry.key, values)
                        }
                    }
                }
            }
        }.getOrDefault(emptyMap())

    private fun decodeList(json: String?): List<String> =
        runCatching {
            val root = objectMapper.readTree(json?.takeIf { it.isNotBlank() } ?: "[]")
            if (!root.isArray) {
                emptyList()
            } else {
                buildList {
                    root.forEach { item ->
                        val value = item.asString("").trim()
                        if (value.isNotBlank()) {
                            add(value)
                        }
                    }
                }
            }
        }.getOrDefault(emptyList())

    private fun decodeEvaluation(json: String?): RewriteEvaluationResponse? =
        runCatching {
            val raw = json?.takeIf { it.isNotBlank() && it != "null" } ?: return null
            objectMapper.readValue(raw, RewriteEvaluationResponse::class.java)
        }.getOrNull()
}
