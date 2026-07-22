package edu.kcg.rewriting_tool.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.databind.ObjectMapper

@Service
class VocabularySuggestionService(
    @Value("\${datamuse.enabled:true}") private val enabled: Boolean,
    @Value("\${datamuse.api-url:https://api.datamuse.com/words}") private val apiUrl: String,
    private val restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(VocabularySuggestionService::class.java)
    private val wordPattern = Regex("\\b[A-Za-z][A-Za-z'-]{6,}\\b")

    fun collectSuggestions(text: String): Map<String, List<String>> {
        if (!enabled) {
            return emptyMap()
        }

        val words = wordPattern
            .findAll(text)
            .map { match -> match.value.trim('\'', '-').lowercase() }
            .filter { word -> word.length >= 7 }
            .distinct()
            .take(12)
            .toList()

        return words
            .mapNotNull { word ->
                val suggestions = getSimpleSynonyms(word)
                if (suggestions.isEmpty()) null else word to suggestions.take(5)
            }
            .toMap()
    }

    private fun getSimpleSynonyms(word: String): List<String> =
        runCatching {
            val uri = UriComponentsBuilder
                .fromUriString(apiUrl)
                .queryParam("rel_syn", word)
                .queryParam("max", 8)
                .build()
                .toUri()
            val responseBody = restClientBuilder
                .build()
                .get()
                .uri(uri)
                .retrieve()
                .body(String::class.java)
                .orEmpty()

            val root = objectMapper.readTree(responseBody)
            if (!root.isArray) {
                return emptyList()
            }

            buildList {
                root.forEach { item ->
                    val suggestion = item.path("word").asString("").trim()
                    if (suggestion.isNotBlank()) {
                        add(suggestion)
                    }
                }
            }
        }.onFailure { error ->
            logger.debug("Datamuse suggestions failed for '{}': {}", word, error.message)
        }.getOrDefault(emptyList())
}
