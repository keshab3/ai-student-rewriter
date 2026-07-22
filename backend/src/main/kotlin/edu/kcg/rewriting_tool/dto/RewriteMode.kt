package edu.kcg.rewriting_tool.dto

enum class RewriteMode(
    val label: String,
    val description: String,
) {
    GRAMMAR_FIX(
        "Grammar fix",
        "Clean grammar, spelling, punctuation, and capitalization while keeping the same meaning.",
    ),
    ACADEMIC_REWRITE(
        "Academic rewrite",
        "Make the writing sound more formal, structured, and school-appropriate.",
    ),
    SIMPLE_REWRITE(
        "Simple rewrite",
        "Rewrite the text in clearer and easier English.",
    ),
    SHORTER_VERSION(
        "Shorter version",
        "Reduce the text to the most important points.",
    ),
    LONGER_VERSION(
        "Longer version",
        "Expand the text with clearer detail and explanation.",
    ),
    PARAPHRASE(
        "Paraphrase",
        "Rewrite the text with different wording while preserving the main idea.",
    ),
    LEVEL_1_ADVANCED(
        "Mode 1 - C1-C2 Advanced",
        "Precise vocabulary, controlled complex sentences, and advanced neutral student writing.",
    ),
    LEVEL_2_CLEAR(
        "Mode 2 - B2-C1 Clear",
        "Strong readable academic wording that is less dense than advanced writing.",
    ),
    LEVEL_3_NATURAL(
        "Mode 3 - B1-B2 Natural",
        "Normal student assignment writing with common academic words and medium sentences.",
    ),
    LEVEL_4_SIMPLE(
        "Mode 4 - A2-B1 Simple",
        "Simple assignment English with short to medium sentences.",
    ),
    LEVEL_5_BASIC(
        "Mode 5 - A1-A2 Basic",
        "Very simple words, short direct sentences, and full meaning preserved.",
    ),
}
