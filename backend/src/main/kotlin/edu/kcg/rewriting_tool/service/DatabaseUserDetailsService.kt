package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.User as SecurityUser
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DatabaseUserDetailsService(
    private val userAccountRepository: UserAccountRepository,
) : UserDetailsService {
    @Transactional(readOnly = true)
    override fun loadUserByUsername(username: String): UserDetails {
        val user = userAccountRepository.findByUsername(username.trim())
            ?: throw UsernameNotFoundException("User not found.")

        return SecurityUser
            .withUsername(user.username)
            .password(user.passwordHash)
            .disabled(!user.enabled)
            .authorities(user.roles.map { SimpleGrantedAuthority("ROLE_${it.name}") })
            .build()
    }
}
