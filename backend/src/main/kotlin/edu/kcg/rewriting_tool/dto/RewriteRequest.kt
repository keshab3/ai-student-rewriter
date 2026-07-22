package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size

data class RewriteRequest(
    @field:NotBlank(message = "Text is required.")
    val text: String = "",

    @field:NotNull(message = "Rewrite mode is required.")
    val mode: RewriteMode = RewriteMode.GRAMMAR_FIX,

    @field:Size(max = 30, message = "Avoid list can contain at most 30 words or phrases.")
    val avoidWords: List<
        @Size(max = 120, message = "Each avoided word or phrase must be 120 characters or fewer.")
        String,
    > = emptyList(),

    @field:Size(max = 4_000, message = "Prompt instruction must be 4,000 characters or fewer.")
    val promptInstruction: String? = null,

    @field:Size(max = 2_000, message = "Output instruction must be 2,000 characters or fewer.")
    val outputInstruction: String? = null,
)
