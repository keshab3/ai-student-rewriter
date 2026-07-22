package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.RewriteModeResponse
import edu.kcg.rewriting_tool.dto.RewriteRequest
import edu.kcg.rewriting_tool.dto.RewriteResponse
import edu.kcg.rewriting_tool.dto.RewriteStatsResponse
import edu.kcg.rewriting_tool.dto.UpdateRewriteRequest
import edu.kcg.rewriting_tool.service.RewriteService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/rewrites")
class RewriteController(
    private val rewriteService: RewriteService,
) {
    @PostMapping
    fun createRewrite(
        authentication: Authentication,
        @Valid @RequestBody request: RewriteRequest,
    ): ResponseEntity<RewriteResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(rewriteService.createRewrite(authentication.name ?: "", request))

    @PostMapping("/preview")
    fun previewRewrite(@Valid @RequestBody request: RewriteRequest): RewriteResponse =
        rewriteService.previewRewrite(request)

    @GetMapping
    fun listRewrites(authentication: Authentication): List<RewriteResponse> =
        rewriteService.listRewrites(authentication.name ?: "")

    @GetMapping("/modes")
    fun listModes(): List<RewriteModeResponse> =
        rewriteService.listModes()

    @GetMapping("/stats")
    fun getStats(authentication: Authentication): RewriteStatsResponse =
        rewriteService.getStats(authentication.name ?: "")

    @GetMapping("/{id}")
    fun getRewrite(authentication: Authentication, @PathVariable id: Long): RewriteResponse =
        rewriteService.getRewrite(authentication.name ?: "", id)

    @PutMapping("/{id}")
    fun updateRewrite(
        authentication: Authentication,
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateRewriteRequest,
    ): RewriteResponse =
        rewriteService.updateRewrite(authentication.name ?: "", id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteRewrite(authentication: Authentication, @PathVariable id: Long) {
        rewriteService.deleteRewrite(authentication.name ?: "", id)
    }
}
