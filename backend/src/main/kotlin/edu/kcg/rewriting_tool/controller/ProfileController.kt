package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.ProfileResponse
import edu.kcg.rewriting_tool.dto.UpdateProfileRequest
import edu.kcg.rewriting_tool.service.UserAccountService
import jakarta.validation.Valid
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/profile")
class ProfileController(
    private val userAccountService: UserAccountService,
) {
    @GetMapping
    fun getProfile(authentication: Authentication): ProfileResponse =
        userAccountService.getProfile(authentication.name ?: "")

    @PutMapping
    fun updateProfile(
        authentication: Authentication,
        @Valid @RequestBody request: UpdateProfileRequest,
    ): ProfileResponse =
        userAccountService.updateProfile(authentication.name ?: "", request)
}
