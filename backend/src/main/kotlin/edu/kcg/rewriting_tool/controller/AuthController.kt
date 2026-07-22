package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.RegisterRequest
import edu.kcg.rewriting_tool.dto.UserSessionResponse
import edu.kcg.rewriting_tool.service.UserAccountService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userAccountService: UserAccountService,
) {
    @PostMapping("/register")
    fun register(@Valid @RequestBody request: RegisterRequest): ResponseEntity<UserSessionResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(userAccountService.register(request))

    @GetMapping("/me")
    fun me(authentication: Authentication): UserSessionResponse =
        userAccountService.getSession(authentication.name ?: "")
}
