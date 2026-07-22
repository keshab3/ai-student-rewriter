package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.ExtractedTextResponse
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets

private const val MAX_TEXT_UPLOAD_BYTES = 5 * 1024 * 1024L

@Service
class TextUploadService {
    fun extractText(file: MultipartFile): ExtractedTextResponse {
        if (file.isEmpty) {
            throw TextUploadException("Choose a file with text.")
        }
        if (file.size > MAX_TEXT_UPLOAD_BYTES) {
            throw TextUploadException("File must be 5MB or smaller.")
        }

        val filename = file.originalFilename?.trim().orEmpty().ifBlank { "uploaded-file" }
        val extension = filename.substringAfterLast('.', "").lowercase()

        val extracted = try {
            when (extension) {
                "txt", "md", "markdown" -> String(file.bytes, StandardCharsets.UTF_8)
                "pdf" -> extractPdf(file.bytes)
                "docx" -> extractDocx(file.bytes)
                else -> throw TextUploadException("Supported formats are .txt, .docx, .pdf, and .md.")
            }
        } catch (error: TextUploadException) {
            throw error
        } catch (error: Exception) {
            throw TextUploadException("Could not read this file. Try an unlocked document or plain text file.")
        }

        val cleaned = cleanText(extracted)
        if (cleaned.isBlank()) {
            throw TextUploadException("No readable text was found in this file.")
        }

        return ExtractedTextResponse(
            filename = filename,
            text = cleaned,
            characterCount = cleaned.length,
        )
    }

    private fun extractPdf(bytes: ByteArray): String =
        ByteArrayInputStream(bytes).use { input ->
            PDDocument.load(input).use { document ->
                PDFTextStripper().getText(document)
            }
        }

    private fun extractDocx(bytes: ByteArray): String =
        ByteArrayInputStream(bytes).use { input ->
            XWPFDocument(input).use { document ->
                val paragraphs = document.paragraphs.map { it.text }
                val tables = document.tables.flatMap { table ->
                    table.rows.flatMap { row -> row.tableCells.map { cell -> cell.text } }
                }
                (paragraphs + tables).joinToString("\n")
            }
        }

    private fun cleanText(value: String): String =
        value
            .replace("\u0000", "")
            .replace(Regex("[\\t\\u000B\\f ]+"), " ")
            .lines()
            .map { it.trimEnd() }
            .dropWhile { it.isBlank() }
            .dropLastWhile { it.isBlank() }
            .joinToString("\n")
            .trim()
}

class TextUploadException(message: String) : RuntimeException(message)
