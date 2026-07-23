package edu.kcg.rewriting_tool

import org.hamcrest.Matchers.hasItem
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.Base64
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
class RewriteControllerTests(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `guest rewrite preview does not require login`() {
        mockMvc.perform(
            post("/api/rewrites/preview")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"text":"im learning because i want write better","mode":"GRAMMAR_FIX"}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(0))
            .andExpect(jsonPath("$.rewrittenText").isNotEmpty)
            .andExpect(jsonPath("$.mode").value("GRAMMAR_FIX"))
    }

    @Test
    fun `guest rewrite preview returns avoid word and checklist metadata`() {
        mockMvc.perform(
            post("/api/rewrites/preview")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "text": "Technology is very important because students use technology to finish assignments.",
                      "mode": "LEVEL_4_SIMPLE",
                      "avoidWords": ["technology", "very important"]
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.mode").value("LEVEL_4_SIMPLE"))
            .andExpect(jsonPath("$.avoidWords[0]").value("technology"))
            .andExpect(jsonPath("$.avoidWords[1]").value("very important"))
            .andExpect(jsonPath("$.matchedAvoidWords").isEmpty)
            .andExpect(jsonPath("$.vocabularySuggestions").isMap)
            .andExpect(jsonPath("$.evaluation.finalDecision").isNotEmpty)
            .andExpect(jsonPath("$.evaluation.scores").isMap)
    }

    @Test
    fun `guest cannot save rewrite to database`() {
        mockMvc.perform(
            post("/api/rewrites")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"text":"im learning because i want write better","mode":"GRAMMAR_FIX"}"""),
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `logged in user post rewrite creates database history item`() {
        mockMvc.perform(
            post("/api/rewrites")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"text":"im learning because i want write better","mode":"GRAMMAR_FIX"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").isNumber)
            .andExpect(jsonPath("$.rewrittenText").isNotEmpty)
            .andExpect(jsonPath("$.mode").value("GRAMMAR_FIX"))
    }

    @Test
    fun `modes endpoint returns rewrite options`() {
        mockMvc.perform(get("/api/rewrites/modes"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].value").value("GRAMMAR_FIX"))
            .andExpect(jsonPath("$[0].label").isNotEmpty)
            .andExpect(jsonPath("$[*].value", hasItem("LEVEL_1_ADVANCED")))
            .andExpect(jsonPath("$[*].value", hasItem("LEVEL_5_BASIC")))
    }

    @Test
    fun `guest can upload text file for extraction`() {
        val file = MockMultipartFile(
            "file",
            "assignment.txt",
            MediaType.TEXT_PLAIN_VALUE,
            "This text came from an uploaded assignment file.".toByteArray(),
        )

        mockMvc.perform(multipart("/api/uploads/text").file(file))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.filename").value("assignment.txt"))
            .andExpect(jsonPath("$.text").value("This text came from an uploaded assignment file."))
            .andExpect(jsonPath("$.characterCount").isNumber)
    }

    @Test
    fun `admin prompt settings require authentication`() {
        mockMvc.perform(get("/api/admin/prompt-settings"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `admin can update prompt setting used by public modes`() {
        mockMvc.perform(
            put("/api/admin/prompt-settings/GRAMMAR_FIX")
                .header(HttpHeaders.AUTHORIZATION, basicAuth())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "label": "Grammar admin",
                      "description": "Admin controlled grammar prompt.",
                      "promptInstruction": "Fix grammar only and keep the same meaning.",
                      "outputInstruction": "Return only the corrected sentence.",
                      "enabled": true
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.label").value("Grammar admin"))
            .andExpect(jsonPath("$.promptInstruction").value("Fix grammar only and keep the same meaning."))
            .andExpect(jsonPath("$.outputInstruction").value("Return only the corrected sentence."))

        mockMvc.perform(get("/api/rewrites/modes"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].value").value("GRAMMAR_FIX"))
            .andExpect(jsonPath("$[0].label").value("Grammar admin"))
    }

    @Test
    fun `register user then read and update profile`() {
        val username = "student-${UUID.randomUUID()}"
        mockMvc.perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "username": "$username",
                      "password": "student123",
                      "displayName": "Test Student",
                      "fullName": "Test Student",
                      "email": "student@example.com"
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.username").value(username))
            .andExpect(jsonPath("$.roles[0]").value("USER"))

        mockMvc.perform(
            get("/api/auth/me")
                .header(HttpHeaders.AUTHORIZATION, basicAuth(username, "student123")),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.displayName").value("Test Student"))

        mockMvc.perform(
            put("/api/profile")
                .header(HttpHeaders.AUTHORIZATION, basicAuth(username, "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "displayName": "Updated Student",
                      "fullName": "Updated Student Name",
                      "email": "updated@example.com"
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.displayName").value("Updated Student"))
            .andExpect(jsonPath("$.email").value("updated@example.com"))
    }

    @Test
    fun `admin can list and delete user accounts`() {
        val username = "delete-${UUID.randomUUID()}"
        val password = "student123"
        mockMvc.perform(
            post("/api/admin/users")
                .header(HttpHeaders.AUTHORIZATION, basicAuth())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "username": "$username",
                      "password": "$password",
                      "displayName": "Delete Me",
                      "fullName": "Delete Me",
                      "email": "delete@example.com",
                      "enabled": true
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.username").value(username))

        val usersJson = mockMvc.perform(
            get("/api/admin/users")
                .header(HttpHeaders.AUTHORIZATION, basicAuth()),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[*].username", hasItem(username)))
            .andReturn()
            .response
            .contentAsString
        val userId = Regex(""""id"\s*:\s*(\d+)[^}]*"username"\s*:\s*"${Regex.escape(username)}"""")
            .find(usersJson)
            ?.groupValues
            ?.get(1)
            ?: error("Admin user id was missing.")
        val updatedUsername = "$username-updated"

        mockMvc.perform(
            put("/api/admin/users/$userId")
                .header(HttpHeaders.AUTHORIZATION, basicAuth())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "username": "$updatedUsername",
                      "password": "updated123",
                      "displayName": "Updated User",
                      "fullName": "Updated User Name",
                      "email": "updated-delete@example.com",
                      "enabled": true
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.username").value(updatedUsername))
            .andExpect(jsonPath("$.displayName").value("Updated User"))

        mockMvc.perform(
            delete("/api/admin/users/$userId")
                .header(HttpHeaders.AUTHORIZATION, basicAuth()),
        )
            .andExpect(status().isNoContent)

        mockMvc.perform(
            get("/api/auth/me")
                .header(HttpHeaders.AUTHORIZATION, basicAuth(updatedUsername, "updated123")),
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `rewrite history supports update for CRUD`() {
        val created = mockMvc.perform(
            post("/api/rewrites")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"text":"im learning because i want write better","mode":"GRAMMAR_FIX"}"""),
        )
            .andExpect(status().isCreated)
            .andReturn()
            .response
            .contentAsString
        val id = Regex(""""id"\s*:\s*(\d+)""").find(created)?.groupValues?.get(1)
            ?: error("Created rewrite id was missing.")

        mockMvc.perform(
            put("/api/rewrites/$id")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "originalText": "I am learning English.",
                      "rewrittenText": "I am studying English carefully.",
                      "mode": "ACADEMIC_REWRITE"
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(id.toInt()))
            .andExpect(jsonPath("$.mode").value("ACADEMIC_REWRITE"))
            .andExpect(jsonPath("$.rewrittenText").value("I am studying English carefully."))
    }

    @Test
    fun `logged in user can save own prompt output setting`() {
        mockMvc.perform(
            get("/api/user/prompt-settings")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123")),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].promptInstruction").isNotEmpty)
            .andExpect(jsonPath("$[0].outputInstruction").isNotEmpty)

        mockMvc.perform(
            put("/api/user/prompt-settings/LEVEL_3_NATURAL")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "promptInstruction": "Rewrite like my own natural student assignment style.",
                      "outputInstruction": "Return only my final rewritten paragraph."
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.mode").value("LEVEL_3_NATURAL"))
            .andExpect(jsonPath("$.customized").value(true))
            .andExpect(jsonPath("$.promptInstruction").value("Rewrite like my own natural student assignment style."))
            .andExpect(jsonPath("$.outputInstruction").value("Return only my final rewritten paragraph."))
    }

    @Test
    fun `guest cannot save contact message to database`() {
        mockMvc.perform(
            post("/api/contact")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "Test User",
                      "email": "contact@example.com",
                      "subject": "Project feedback",
                      "message": "This should stay local for guests."
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `logged in user contact endpoint saves message`() {
        mockMvc.perform(
            post("/api/contact")
                .header(HttpHeaders.AUTHORIZATION, basicAuth("student", "student123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "Test User",
                      "email": "contact@example.com",
                      "subject": "Project feedback",
                      "message": "This is a real saved contact message."
                    }
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").isNumber)
            .andExpect(jsonPath("$.email").value("contact@example.com"))
    }

    private fun basicAuth(username: String = "admin", password: String = "admin123"): String {
        val token = Base64.getEncoder().encodeToString("$username:$password".toByteArray())
        return "Basic $token"
    }
}
