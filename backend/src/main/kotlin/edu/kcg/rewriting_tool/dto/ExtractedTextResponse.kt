package edu.kcg.rewriting_tool.dto

data class ExtractedTextResponse(
    val filename: String,
    val text: String,
    val characterCount: Int,
)
