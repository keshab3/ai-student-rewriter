package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.entity.Role
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.entity.UserProfile
import edu.kcg.rewriting_tool.repository.RoleRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class ApplicationDataInitializer(
    private val roleRepository: RoleRepository,
    private val userAccountRepository: UserAccountRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${app.admin.username:admin}") private val adminUsername: String,
    @Value("\${app.admin.password:admin123}") private val adminPassword: String,
    @Value("\${app.user.username:student}") private val userUsername: String,
    @Value("\${app.user.password:student123}") private val userPassword: String,
) {
    @EventListener(ApplicationReadyEvent::class)
    @Transactional
    fun initialize() {
        val adminRole = seedRole("ADMIN")
        val userRole = seedRole("USER")

        seedUser(
            username = adminUsername,
            password = adminPassword,
            displayName = "Administrator",
            email = "admin@example.local",
            roles = setOf(adminRole, userRole),
        )

        seedUser(
            username = userUsername,
            password = userPassword,
            displayName = "Student User",
            email = "student@example.local",
            roles = setOf(userRole),
        )
    }

    private fun seedRole(name: String): Role =
        roleRepository.findByName(name) ?: roleRepository.save(Role(name = name))

    private fun seedUser(
        username: String,
        password: String,
        displayName: String,
        email: String,
        roles: Set<Role>,
    ) {
        val normalizedUsername = username.trim()
        if (normalizedUsername.isBlank()) {
            return
        }
        val existingUser = userAccountRepository.findByUsername(normalizedUsername)

        if (existingUser == null) {
            val user = UserAccount(
                username = normalizedUsername,
                passwordHash = passwordEncoder.encode(password) ?: error("Could not encode seeded user password."),
                displayName = displayName,
                enabled = true,
                createdAt = LocalDateTime.now(),
                roles = roles.toMutableSet(),
            )
            val profile = UserProfile(
                user = user,
                fullName = displayName,
                email = email,
            )
            user.profile = profile
            userAccountRepository.save(user)
            return
        }

        existingUser.enabled = true
        existingUser.roles.addAll(roles)
        if (existingUser.profile == null) {
            existingUser.profile = UserProfile(
                user = existingUser,
                fullName = displayName,
                email = email,
            )
        }
        userAccountRepository.save(existingUser)
    }
}
