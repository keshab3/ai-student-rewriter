package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.ProfileResponse
import edu.kcg.rewriting_tool.dto.RegisterRequest
import edu.kcg.rewriting_tool.dto.UpdateProfileRequest
import edu.kcg.rewriting_tool.dto.UserSessionResponse
import edu.kcg.rewriting_tool.entity.Role
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.entity.UserProfile
import edu.kcg.rewriting_tool.repository.RoleRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class UserAccountService(
    private val userAccountRepository: UserAccountRepository,
    private val roleRepository: RoleRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    @Transactional
    fun register(request: RegisterRequest): UserSessionResponse {
        val username = request.username.trim()
        if (userAccountRepository.findByUsername(username) != null) {
            throw UsernameAlreadyExistsException(username)
        }

        val userRole = roleRepository.findByName("USER") ?: roleRepository.save(Role(name = "USER"))
        val user = UserAccount(
            username = username,
            passwordHash = passwordEncoder.encode(request.password)
                ?: error("Could not encode registered user password."),
            displayName = request.displayName.trim(),
            enabled = true,
            createdAt = LocalDateTime.now(),
            roles = mutableSetOf(userRole),
        )
        user.profile = UserProfile(
            user = user,
            fullName = request.fullName.trim(),
            email = request.email.trim(),
        )

        return userAccountRepository.save(user).toSessionResponse()
    }

    @Transactional(readOnly = true)
    fun getSession(username: String): UserSessionResponse =
        loadUser(username).toSessionResponse()

    @Transactional(readOnly = true)
    fun getProfile(username: String): ProfileResponse =
        loadUser(username).toProfileResponse()

    @Transactional
    fun updateProfile(username: String, request: UpdateProfileRequest): ProfileResponse {
        val user = loadUser(username)
        user.displayName = request.displayName.trim()

        val profile = user.profile ?: UserProfile(user = user)
        profile.fullName = request.fullName.trim()
        profile.email = request.email.trim()
        user.profile = profile

        return userAccountRepository.save(user).toProfileResponse()
    }

    private fun loadUser(username: String): UserAccount =
        userAccountRepository.findByUsername(username.trim())
            ?: throw UserAccountNotFoundException(username)

    private fun UserAccount.toSessionResponse(): UserSessionResponse =
        UserSessionResponse(
            username = username,
            displayName = displayName,
            roles = roles.map { it.name }.sorted(),
        )

    private fun UserAccount.toProfileResponse(): ProfileResponse {
        val currentProfile = profile
        return ProfileResponse(
            username = username,
            displayName = displayName,
            fullName = currentProfile?.fullName.orEmpty(),
            email = currentProfile?.email.orEmpty(),
            roles = roles.map { it.name }.sorted(),
            createdAt = createdAt,
        )
    }
}
