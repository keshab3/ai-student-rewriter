package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.entity.PromptSetting
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper

@Service
class AiRewriteClient(
    @Value("\${openai.api-key:}") private val apiKey: String,
    @Value("\${openai.model:gpt-5.6-luna}") private val model: String,
    @Value("\${openai.base-url:https://api.openai.com/v1}") private val baseUrl: String,
    private val restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
    private val rewriteConstraintService: RewriteConstraintService,
) {
    constructor() : this(
        apiKey = "",
        model = "gpt-5.6-luna",
        baseUrl = "https://api.openai.com/v1",
        restClientBuilder = RestClient.builder(),
        objectMapper = ObjectMapper(),
        rewriteConstraintService = RewriteConstraintService(),
    )

    private val logger = LoggerFactory.getLogger(AiRewriteClient::class.java)

    fun rewrite(
        text: String,
        mode: RewriteMode,
        promptSetting: PromptSetting? = null,
        vocabularySuggestions: Map<String, List<String>> = emptyMap(),
        avoidWords: List<String> = emptyList(),
    ): String {
        val cleaned = normalize(text)
        val normalizedAvoidWords = rewriteConstraintService.normalizeAvoidWords(avoidWords)
        if (apiKey.isNotBlank()) {
            runCatching { rewriteWithOpenAi(cleaned, mode, promptSetting, vocabularySuggestions, normalizedAvoidWords) }
                .onSuccess { rewritten ->
                    if (rewritten.isNotBlank()) {
                        return enforceAvoidWords(alignLevelOutput(rewritten, mode), normalizedAvoidWords)
                    }
                }
                .onFailure { error ->
                    logger.warn("OpenAI rewrite failed. Falling back to local rewrite: {}", error.message)
                }
        }

        return enforceAvoidWords(rewriteLocally(cleaned, mode), normalizedAvoidWords)
    }

    private fun alignLevelOutput(text: String, mode: RewriteMode): String =
        when (mode) {
            RewriteMode.LEVEL_1_ADVANCED -> advancedStudentRewrite(text)
            RewriteMode.LEVEL_2_CLEAR -> clearStudentRewrite(text)
            RewriteMode.LEVEL_3_NATURAL -> naturalStudentRewrite(text)
            RewriteMode.LEVEL_4_SIMPLE -> simpleStudentRewrite(text)
            RewriteMode.LEVEL_5_BASIC -> basicStudentRewrite(text)
            else -> text.trim()
        }

    private fun rewriteWithOpenAi(
        text: String,
        mode: RewriteMode,
        promptSetting: PromptSetting?,
        vocabularySuggestions: Map<String, List<String>>,
        avoidWords: List<String>,
    ): String {
        val responseBody = restClientBuilder
            .baseUrl(baseUrl.trimEnd('/'))
            .build()
            .post()
            .uri("/responses")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $apiKey")
            .contentType(MediaType.APPLICATION_JSON)
            .body(
                mapOf(
                    "model" to model,
                    "instructions" to buildInstructions(mode, promptSetting, vocabularySuggestions, avoidWords),
                    "input" to text,
                    "store" to false,
                ),
            )
            .retrieve()
            .body(String::class.java)
            ?: error("OpenAI returned an empty response.")

        return extractOutputText(responseBody)
    }

    private fun buildInstructions(
        mode: RewriteMode,
        promptSetting: PromptSetting?,
        vocabularySuggestions: Map<String, List<String>>,
        avoidWords: List<String>,
    ): String {
        val label = promptSetting?.label?.takeIf { it.isNotBlank() } ?: mode.label
        val description = promptSetting?.description?.takeIf { it.isNotBlank() } ?: mode.description
        val instruction = promptSetting?.promptInstruction?.takeIf { it.isNotBlank() } ?: description
        val outputInstruction = promptSetting?.outputInstruction
            ?.takeIf { it.isNotBlank() }
            ?: "Return only the rewritten text. Do not add explanations, labels, markdown, or quotation marks."

        return """
        You rewrite student writing for an assignment helper.
        Hard rules:
        - Follow the selected English level contract before any custom prompt.
        - Keep a student-written assignment tone, not a teacher, marketing, or AI assistant tone.
        - Keep a neutral tone. Do not add emotion, claims, opinions, or advice that the student did not write.
        - Preserve the student's meaning and do not invent facts.
        - Preserve paragraphs, bullets, numbering, headings, citations, topic order, and student flow when they exist.
        - Return only the final rewritten text.
        Selected mode: $label.
        Mode summary: $description
        Selected English level contract: ${levelContract(mode)}
        Admin/user prompt preference: $instruction
        Output instruction: $outputInstruction
        Datamuse vocabulary hints:
        ${formatVocabularySuggestions(vocabularySuggestions)}
        Avoid words or phrases:
        ${formatAvoidWords(avoidWords)}
        If avoid words are provided, do not include those exact terms case-insensitively in the final output. Use accurate synonyms or short paraphrases while keeping the same meaning.
        """.trimIndent()
    }

    private fun extractOutputText(responseBody: String): String {
        val root = objectMapper.readTree(responseBody)
        val directOutput = root.path("output_text").asString("")
        if (directOutput.isNotBlank()) {
            return directOutput.trim()
        }

        val output = root.path("output")
        if (output.isArray) {
            val collected = buildList {
                output.forEach { item ->
                    val content = item.path("content")
                    if (content.isArray) {
                        content.forEach { contentItem ->
                            val text = contentItem.path("text").asString("")
                            if (text.isNotBlank()) {
                                add(text)
                            }
                        }
                    }
                }
            }
            if (collected.isNotEmpty()) {
                return collected.joinToString(" ").trim()
            }
        }

        error("OpenAI response did not contain text output.")
    }

    private fun rewriteLocally(text: String, mode: RewriteMode): String {
        return when (mode) {
            RewriteMode.GRAMMAR_FIX -> grammarFix(text)
            RewriteMode.ACADEMIC_REWRITE -> academicRewrite(text)
            RewriteMode.SIMPLE_REWRITE -> simpleRewrite(text)
            RewriteMode.SHORTER_VERSION -> shorterVersion(text)
            RewriteMode.LONGER_VERSION -> longerVersion(text)
            RewriteMode.PARAPHRASE -> paraphrase(text)
            RewriteMode.LEVEL_1_ADVANCED -> levelRewrite(text, mode)
            RewriteMode.LEVEL_2_CLEAR -> levelRewrite(text, mode)
            RewriteMode.LEVEL_3_NATURAL -> levelRewrite(text, mode)
            RewriteMode.LEVEL_4_SIMPLE -> levelRewrite(text, mode)
            RewriteMode.LEVEL_5_BASIC -> levelRewrite(text, mode)
        }
    }

    private fun normalize(text: String): String =
        text
            .replace(Regex("\\s+"), " ")
            .replace(Regex("\\s+([,.!?;:])"), "$1")
            .trim()

    private fun grammarFix(text: String): String {
        val corrected = text
            .replaceWord("im", "I am")
            .replaceWord("i'm", "I am")
            .replaceWord("i", "I")
            .replaceWord("dont", "do not")
            .replaceWord("don't", "do not")
            .replaceWord("cant", "cannot")
            .replaceWord("can't", "cannot")
            .replaceWord("wont", "will not")
            .replaceWord("won't", "will not")
            .replaceWord("didnt", "did not")
            .replaceWord("didn't", "did not")
            .replaceWord("doesnt", "does not")
            .replaceWord("doesn't", "does not")
            .replaceWord("isnt", "is not")
            .replaceWord("isn't", "is not")
            .replaceWord("arent", "are not")
            .replaceWord("aren't", "are not")
            .replaceWord("shouldnt", "should not")
            .replaceWord("shouldn't", "should not")
            .replaceWord("couldnt", "could not")
            .replaceWord("couldn't", "could not")
            .replaceWord("wouldnt", "would not")
            .replaceWord("wouldn't", "would not")
            .replace(Regex("\\s+"), " ")
            .replace(Regex("\\s+([,.!?;:])"), "$1")
            .trim()

        return splitSentences(corrected)
            .joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) }
    }

    private fun academicRewrite(text: String): String {
        val formal = grammarFix(text)
            .replacePhrase("a lot of", "many")
            .replacePhrase("lots of", "many")
            .replacePhrase("kids", "students")
            .replacePhrase("things", "factors")
            .replacePhrase("thing", "factor")
            .replacePhrase("good", "beneficial")
            .replacePhrase("bad", "problematic")
            .replacePhrase("big", "significant")
            .replacePhrase("small", "limited")
            .replacePhrase("get", "receive")
            .replacePhrase("use", "apply")
            .replacePhrase("help", "support")
            .replacePhrase("show", "demonstrate")
            .replacePhrase("I think", "This suggests")
            .replacePhrase("I believe", "This indicates")

        return splitSentences(formal)
            .joinToString(" ") { sentence ->
                val clearSentence = sentence
                    .removePrefix("And ")
                    .removePrefix("But ")
                    .trim()
                ensureEnding(capitalizeFirst(clearSentence))
            }
    }

    private fun simpleRewrite(text: String): String {
        val simple = grammarFix(text)
            .replacePhrase("utilize", "use")
            .replacePhrase("approximately", "about")
            .replacePhrase("significant", "important")
            .replacePhrase("beneficial", "helpful")
            .replacePhrase("problematic", "not good")
            .replacePhrase("demonstrate", "show")
            .replacePhrase("therefore", "so")
            .replacePhrase("however", "but")
            .replacePhrase("consequently", "so")
            .replacePhrase("additional", "more")

        return splitSentences(simple).joinToString(" ") { ensureEnding(capitalizeFirst(it)) }
    }

    private fun shorterVersion(text: String): String {
        val fixed = grammarFix(text)
        val sentences = splitSentences(fixed)
        val selected = when {
            sentences.size <= 2 -> sentences
            sentences.size <= 4 -> listOf(sentences.first(), sentences.last())
            else -> sentences.take(3)
        }

        return selected
            .joinToString(" ")
            .replacePhrase("in order to", "to")
            .replacePhrase("due to the fact that", "because")
            .replacePhrase("at this point in time", "now")
            .replacePhrase("it is important to note that", "")
            .replace(Regex("\\b(really|very|basically|actually|just)\\b", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s+"), " ")
            .trim()
            .let { if (it.isBlank()) fixed else it }
    }

    private fun longerVersion(text: String): String {
        val fixed = grammarFix(text)
        return splitSentences(fixed).joinToString(" ") { sentence ->
            val base = ensureEnding(capitalizeFirst(sentence))
            val detail = when {
                base.contains("student", ignoreCase = true) ->
                    "This is important because students need clear ideas, organized language, and confidence in their writing."
                base.contains("learn", ignoreCase = true) || base.contains("study", ignoreCase = true) ->
                    "This also supports better understanding because the idea becomes easier to follow and remember."
                base.contains("technology", ignoreCase = true) || base.contains("AI", ignoreCase = true) ->
                    "With careful use, technology can support learning while still keeping the student's own meaning."
                else ->
                    "This point can be explained more clearly by adding specific details and connecting it to the main idea."
            }
            "$base $detail"
        }
    }

    private fun paraphrase(text: String): String {
        val paraphrased = grammarFix(text)
            .replacePhrase("important", "valuable")
            .replacePhrase("helpful", "useful")
            .replacePhrase("because", "since")
            .replacePhrase("many", "several")
            .replacePhrase("students", "learners")
            .replacePhrase("people", "individuals")
            .replacePhrase("use", "work with")
            .replacePhrase("learn", "understand")
            .replacePhrase("write", "express ideas")
            .replacePhrase("improve", "make better")
            .replacePhrase("problem", "challenge")
            .replacePhrase("result", "outcome")

        return splitSentences(paraphrased).joinToString(" ") { sentence ->
            val trimmed = sentence.trim()
            when {
                trimmed.startsWith("I ", ignoreCase = true) ->
                    ensureEnding(capitalizeFirst(trimmed.replaceFirst(Regex("^I\\s+", RegexOption.IGNORE_CASE), "The writer ")))
                trimmed.length > 30 ->
                    ensureEnding("In other words, ${trimmed.replaceFirstChar { it.lowercase() }}")
                else -> ensureEnding(capitalizeFirst(trimmed))
            }
        }
    }

    private fun levelRewrite(text: String, mode: RewriteMode): String =
        when (mode) {
            RewriteMode.LEVEL_1_ADVANCED -> advancedStudentRewrite(text)
            RewriteMode.LEVEL_2_CLEAR -> clearStudentRewrite(text)
            RewriteMode.LEVEL_3_NATURAL -> naturalStudentRewrite(text)
            RewriteMode.LEVEL_4_SIMPLE -> simpleStudentRewrite(text)
            RewriteMode.LEVEL_5_BASIC -> basicStudentRewrite(text)
            else -> grammarFix(text)
        }

    private fun levelContract(mode: RewriteMode): String =
        when (mode) {
            RewriteMode.LEVEL_1_ADVANCED ->
                "C1-C2 advanced English. Use precise academic vocabulary, controlled complex sentences, and neutral student voice."
            RewriteMode.LEVEL_2_CLEAR ->
                "B2-C1 clear English. Use strong readable academic wording, clear transitions, and medium-complex sentences."
            RewriteMode.LEVEL_3_NATURAL ->
                "B1-B2 natural student English. Use normal assignment language, common academic words, and medium sentences."
            RewriteMode.LEVEL_4_SIMPLE ->
                "A2-B1 simple English. Use common words, short to medium sentences, and clear student tone."
            RewriteMode.LEVEL_5_BASIC ->
                "A1-A2 basic English. Use very common words and short direct sentences. Use one idea per sentence when possible."
            RewriteMode.GRAMMAR_FIX ->
                "Keep the original level. Fix grammar, spelling, punctuation, and capitalization only."
            RewriteMode.ACADEMIC_REWRITE ->
                "Use formal academic English while keeping the student's original meaning and neutral tone."
            RewriteMode.SIMPLE_REWRITE ->
                "Use easier English with clear sentence structure and the same meaning."
            RewriteMode.SHORTER_VERSION ->
                "Keep only the main points without adding new facts."
            RewriteMode.LONGER_VERSION ->
                "Add clear explanation only from the student's original idea. Do not invent facts."
            RewriteMode.PARAPHRASE ->
                "Use different wording and sentence structure while keeping the same meaning."
        }

    private fun advancedStudentRewrite(text: String): String =
        academicRewrite(text)
            .replacePhrase("helpful", "beneficial")
            .replacePhrase("show", "demonstrate")
            .replacePhrase("use", "apply")
            .replacePhrase("important", "significant")
            .replacePhrase("learn", "develop understanding")
            .let { splitSentences(it).joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) } }

    private fun clearStudentRewrite(text: String): String =
        academicRewrite(text)
            .replacePhrase("significant", "important")
            .replacePhrase("problematic", "a problem")
            .replacePhrase("demonstrate", "show")
            .replacePhrase("apply", "use")
            .let { splitSentences(it).joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) } }

    private fun naturalStudentRewrite(text: String): String =
        simpleRewrite(text)
            .replacePhrase("not good", "a problem")
            .replacePhrase("helpful", "useful")
            .replacePhrase("kids", "students")
            .let { splitSentences(it).joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) } }

    private fun simpleStudentRewrite(text: String): String =
        simpleRewrite(text)
            .replacePhrase("therefore", "so")
            .replacePhrase("significant", "important")
            .replacePhrase("beneficial", "helpful")
            .replacePhrase("approximately", "about")
            .let { splitSentences(it).flatMap { sentence -> splitForShortSentences(sentence, 16) } }
            .joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) }

    private fun basicStudentRewrite(text: String): String =
        simpleRewrite(text)
            .replacePhrase("communication", "talking")
            .replacePhrase("communicate", "talk")
            .replacePhrase("complete", "finish")
            .replacePhrase("assignments", "school work")
            .replacePhrase("assignment", "school work")
            .replacePhrase("understand", "learn")
            .replacePhrase("clearly", "well")
            .replacePhrase("more well", "better")
            .replacePhrase("because", "because")
            .replacePhrase("important", "important")
            .let { splitSentences(it).flatMap { sentence -> splitForShortSentences(sentence, 12) } }
            .map { addBasicSubjectIfNeeded(it) }
            .joinToString(" ") { sentence -> ensureEnding(capitalizeFirst(sentence)) }

    private fun addBasicSubjectIfNeeded(sentence: String): String {
        val trimmed = sentence.trim()
        if (trimmed.isBlank()) return trimmed
        val firstWord = Regex("^[A-Za-z]+").find(trimmed)?.value?.lowercase() ?: return trimmed
        return if (firstWord in basicVerbStarters) {
            "They $trimmed"
        } else {
            trimmed
        }
    }

    private fun splitForShortSentences(sentence: String, maxWords: Int): List<String> {
        val parts = sentence
            .removeSuffix(".")
            .removeSuffix("!")
            .removeSuffix("?")
            .split(Regex("\\s+(?:and|because|so|but)\\s+|,\\s*|;\\s*", RegexOption.IGNORE_CASE))
            .map {
                it.trim().replace(Regex("^(?:and|because|so|but)\\s+", RegexOption.IGNORE_CASE), "")
            }
            .filter { it.isNotBlank() }

        val chunks = parts.flatMap { part ->
            val words = part.split(Regex("\\s+")).filter { it.isNotBlank() }
            if (words.size <= maxWords) {
                listOf(part)
            } else {
                words.chunked(maxWords).map { it.joinToString(" ") }
            }
        }

        return chunks.ifEmpty { listOf(sentence.trim()) }
    }

    private fun enforceAvoidWords(text: String, avoidWords: List<String>): String {
        if (avoidWords.isEmpty()) {
            return text
        }
        val found = rewriteConstraintService.findAvoidedTerms(text, avoidWords)
        return if (found.isEmpty()) text else rewriteConstraintService.removeAvoidedTerms(text, found)
    }

    private fun formatVocabularySuggestions(vocabularySuggestions: Map<String, List<String>>): String {
        if (vocabularySuggestions.isEmpty()) {
            return "No external vocabulary suggestions were provided."
        }

        return vocabularySuggestions.entries.joinToString("\n") { (word, suggestions) ->
            "- $word: ${suggestions.take(5).joinToString(", ")}"
        }
    }

    private fun formatAvoidWords(avoidWords: List<String>): String {
        if (avoidWords.isEmpty()) {
            return "No avoided words or phrases were provided."
        }

        return avoidWords.joinToString("\n") { "- $it" }
    }

    private fun splitSentences(text: String): List<String> =
        text
            .split(Regex("(?<=[.!?])\\s+"))
            .map { it.trim() }
            .filter { it.isNotBlank() }

    private fun capitalizeFirst(text: String): String {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return trimmed
        val firstLetterIndex = trimmed.indexOfFirst { it.isLetter() }
        if (firstLetterIndex == -1) return trimmed
        return trimmed.replaceRange(
            firstLetterIndex,
            firstLetterIndex + 1,
            trimmed[firstLetterIndex].uppercase(),
        )
    }

    private fun ensureEnding(text: String): String {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return trimmed
        return if (trimmed.last() in ".!?") trimmed else "$trimmed."
    }

    private fun String.replaceWord(target: String, replacement: String): String =
        replace(Regex("\\b${Regex.escape(target)}\\b", RegexOption.IGNORE_CASE), replacement)

    private fun String.replacePhrase(target: String, replacement: String): String =
        replace(Regex("\\b${Regex.escape(target)}\\b", RegexOption.IGNORE_CASE), replacement)

    private val basicVerbStarters = setOf(
        "talk",
        "learn",
        "finish",
        "use",
        "write",
        "read",
        "study",
        "work",
        "understand",
        "complete",
        "communicate",
        "improve",
    )
}
