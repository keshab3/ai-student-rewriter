package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.AdminUserResponse
import edu.kcg.rewriting_tool.dto.AdminCreateUserRequest
import edu.kcg.rewriting_tool.dto.AdminUpdateUserRequest
import edu.kcg.rewriting_tool.dto.ProfileResponse
import edu.kcg.rewriting_tool.dto.RegisterRequest
import edu.kcg.rewriting_tool.dto.UpdateProfileRequest
import edu.kcg.rewriting_tool.dto.UserSessionResponse
import edu.kcg.rewriting_tool.entity.Role
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.entity.UserProfile
import edu.kcg.rewriting_tool.repository.AdminAuditLogRepository
import edu.kcg.rewriting_tool.repository.ContactMessageRepository
import edu.kcg.rewriting_tool.repository.RoleRepository
import edu.kcg.rewriting_tool.repository.RewriteHistoryRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import edu.kcg.rewriting_tool.repository.UserPromptSettingRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class UserAccountService(
    private val userAccountRepository: UserAccountRepository,
    private val roleRepository: RoleRepository,
    private val passwordEncoder: PasswordEncoder,
    private val rewriteHistoryRepository: RewriteHistoryRepository,
    private val contactMessageRepository: ContactMessageRepository,
    private val userPromptSettingRepository: UserPromptSettingRepository,
    private val adminAuditLogRepository: AdminAuditLogRepository,
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

    @Transactional(readOnly = true)
    fun listUsersForAdmin(): List<AdminUserResponse> =
        userAccountRepository.findAllByOrderByCreatedAtDesc().map { it.toAdminResponse() }

    @Transactional
    fun createUserForAdmin(request: AdminCreateUserRequest): AdminUserResponse {
        val username = request.username.trim()
        if (userAccountRepository.findByUsername(username) != null) {
            throw UsernameAlreadyExistsException(username)
        }

        val userRole = roleRepository.findByName("USER") ?: roleRepository.save(Role(name = "USER"))
        val user = UserAccount(
            username = username,
            passwordHash = passwordEncoder.encode(request.password)
                ?: error("Could not encode user password."),
            displayName = request.displayName.trim(),
            enabled = request.enabled,
            createdAt = LocalDateTime.now(),
            roles = mutableSetOf(userRole),
        )
        user.profile = UserProfile(
            user = user,
            fullName = request.fullName.trim(),
            email = request.email.trim(),
        )

        return userAccountRepository.save(user).toAdminResponse()
    }

    @Transactional
    fun updateUserForAdmin(id: Long, request: AdminUpdateUserRequest, actorUsername: String): AdminUserResponse {
        val user = userAccountRepository.findById(id).orElseThrow {
            UserAccountNotFoundException(id.toString())
        }
        if (user.username == actorUsername.trim()) {
            throw AdminUserDeleteException("You cannot edit the admin account you are currently using.")
        }

        val username = request.username.trim()
        val existingUser = userAccountRepository.findByUsername(username)
        if (existingUser != null && existingUser.id != user.id) {
            throw UsernameAlreadyExistsException(username)
        }

        user.username = username
        user.displayName = request.displayName.trim()
        user.enabled = request.enabled
        request.password
            ?.takeIf { it.isNotBlank() }
            ?.let { password ->
                user.passwordHash = passwordEncoder.encode(password)
                    ?: error("Could not encode user password.")
            }

        val profile = user.profile ?: UserProfile(user = user)
        profile.fullName = request.fullName.trim()
        profile.email = request.email.trim()
        user.profile = profile

        return userAccountRepository.save(user).toAdminResponse()
    }

    @Transactional
    fun deleteUserForAdmin(id: Long, actorUsername: String): AdminUserResponse {
        val user = userAccountRepository.findById(id).orElseThrow {
            UserAccountNotFoundException(id.toString())
        }

        if (user.username == actorUsername.trim()) {
            throw AdminUserDeleteException("You cannot delete the admin account you are currently using.")
        }

        val response = user.toAdminResponse()
        userPromptSettingRepository.deleteByOwner(user)
        rewriteHistoryRepository.deleteByOwner(user)
        contactMessageRepository.deleteByOwner(user)
        adminAuditLogRepository.clearActor(user)
        user.roles.clear()
        userAccountRepository.delete(user)
        return response
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

    private fun UserAccount.toAdminResponse(): AdminUserResponse {
        val currentProfile = profile
        return AdminUserResponse(
            id = requireNotNull(id),
            username = username,
            displayName = displayName,
            fullName = currentProfile?.fullName.orEmpty(),
            email = currentProfile?.email.orEmpty(),
            roles = roles.map { it.name }.sorted(),
            enabled = enabled,
            createdAt = createdAt,
        )
    }
}
