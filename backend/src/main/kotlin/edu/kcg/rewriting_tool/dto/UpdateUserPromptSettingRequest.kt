package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class UpdateUserPromptSettingRequest(
    @field:NotBlank(message = "Prompt instruction is required.")
    @field:Size(max = 4_000, message = "Prompt instruction must be 4,000 characters or fewer.")
    val promptInstruction: String,

    @field:NotBlank(message = "Output instruction is required.")
    @field:Size(max = 2_000, message = "Output instruction must be 2,000 characters or fewer.")
    val outputInstruction: String,
)
