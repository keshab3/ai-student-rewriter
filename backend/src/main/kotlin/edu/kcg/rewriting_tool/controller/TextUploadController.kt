package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.ExtractedTextResponse
import edu.kcg.rewriting_tool.service.TextUploadService
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/uploads")
class TextUploadController(
    private val textUploadService: TextUploadService,
) {
    @PostMapping("/text", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun extractText(@RequestParam("file") file: MultipartFile): ExtractedTextResponse =
        textUploadService.extractText(file)
}
