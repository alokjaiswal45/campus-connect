
package com.campusconnect.api;

import com.campusconnect.model.*;
import com.campusconnect.repo.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api")
public class AcademicController {

    private final BranchRepository branches;
    private final SubjectRepository subjects;
    private final DocumentRepository documents;
    private final Path uploadDir;

    private static final Set<String> EXAM_TYPES = Set.of(
            "CIE 1",
            "CIE 2",
            "CIE 3",
            "SEE",
            "SUPPLEMENTARY"
    );

    public AcademicController(
            BranchRepository branches,
            SubjectRepository subjects,
            DocumentRepository documents,
            @Value("${app.upload-dir}") String dir) {

        this.branches = branches;
        this.subjects = subjects;
        this.documents = documents;
        this.uploadDir = Paths.get(dir)
                .toAbsolutePath()
                .normalize();
    }

    // ---------- HEALTH ----------

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    // ---------- BRANCHES ----------

    @GetMapping("/branches")
    public List<Branch> getBranches() {
        return branches.findAll();
    }

    @PostMapping("/branches")
    public Branch addBranch(@RequestBody Branch branch) {
        branch.id = null;
        return branches.save(branch);
    }

    @DeleteMapping("/branches/{id}")
    public ResponseEntity<Void> deleteBranch(
            @PathVariable Long id) {

        if (!branches.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Branch not found");
        }

        branches.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ---------- SUBJECTS ----------

    @GetMapping("/subjects")
    public List<Subject> getSubjects(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) Integer semester) {

        return subjects.findAll().stream()
                .filter(s -> branchId == null ||
                        (s.branch != null &&
                         branchId.equals(s.branch.id)))
                .filter(s -> semester == null ||
                        semester.equals(s.semester))
                .toList();
    }

    @PostMapping("/subjects")
    public Subject addSubject(
            @RequestBody Map<String, Object> data) {

        Long branchId;
        int semester;
        String code;
        String name;

        try {
            branchId = Long.valueOf(
                    data.get("branchId").toString());

            semester = Integer.parseInt(
                    data.get("semester").toString());

            code = data.get("code").toString().trim();
            name = data.get("name").toString().trim();

        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid subject details");
        }

        if (semester < 1 || semester > 12 ||
                code.isBlank() || name.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid semester, code or name");
        }

        Branch branch = branches.findById(branchId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Branch not found"));

        Subject subject = new Subject();
        subject.branch = branch;
        subject.semester = semester;
        subject.code = code;
        subject.name = name;

        return subjects.save(subject);
    }

    @DeleteMapping("/subjects/{id}")
    public ResponseEntity<Void> deleteSubject(
            @PathVariable Long id) {

        if (!subjects.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Subject not found");
        }

        subjects.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ---------- DOCUMENTS ----------

    @GetMapping("/documents")
    public List<Document> getDocuments(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) Integer semester,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String examType,
            @RequestParam(required = false) Integer moduleNumber,
            @RequestParam(required = false) String academicYear) {

        return documents.findAll().stream()
                .filter(d -> d.subject != null)
                .filter(d -> branchId == null ||
                        (d.subject.branch != null &&
                         branchId.equals(d.subject.branch.id)))
                .filter(d -> semester == null ||
                        semester.equals(d.subject.semester))
                .filter(d -> subjectId == null ||
                        subjectId.equals(d.subject.id))
                .filter(d -> type == null ||
                        (d.type != null &&
                         d.type.equalsIgnoreCase(type)))
                .filter(d -> examType == null ||
                        (d.examType != null &&
                         d.examType.equalsIgnoreCase(examType)))
                .filter(d -> moduleNumber == null ||
                        moduleNumber.equals(d.moduleNumber))
                .filter(d -> academicYear == null ||
                        academicYear.equals(d.academicYear))
                .toList();
    }

    // ---------- PDF UPLOAD ----------

    @PostMapping(
            value = "/documents",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Document uploadDocument(
            @RequestParam Long subjectId,
            @RequestParam String title,
            @RequestParam String type,
            @RequestParam(required = false) String examType,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) Integer moduleNumber,
            @RequestParam MultipartFile file) throws Exception {

        Subject subject = subjects.findById(subjectId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Subject not found"));

        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Document title is required");
        }

        if (type == null || type.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Document type is required");
        }

        String normalizedType =
                type.trim().toUpperCase(Locale.ROOT);

        if (!normalizedType.equals("RESOURCE") &&
                !normalizedType.equals("PAPER")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Type must be RESOURCE or PAPER");
        }

        String normalizedExamType = null;
        String normalizedYear = null;
        Integer selectedModule = null;

        if (normalizedType.equals("RESOURCE")) {

            if (moduleNumber == null ||
                    moduleNumber < 1 ||
                    moduleNumber > 5) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Select a module from 1 to 5");
            }

            selectedModule = moduleNumber;

        } else {

            if (examType == null || examType.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Exam type is required");
            }

            normalizedExamType =
                    examType.trim().toUpperCase(Locale.ROOT);

            if (normalizedExamType.equals("SUPPLEMENTARY EXAM")) {
                normalizedExamType = "SUPPLEMENTARY";
            }

            if (!EXAM_TYPES.contains(normalizedExamType)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid exam type");
            }

            if (academicYear == null ||
                    !academicYear.trim().matches("\\d{4}")) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Enter a valid four-digit exam year");
            }

            normalizedYear = academicYear.trim();
        }

        if (file.isEmpty() ||
                file.getSize() > 20L * 1024 * 1024) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "PDF size must be between 1 byte and 20 MB");
        }

        byte[] bytes = file.getBytes();

        if (bytes.length < 5 ||
                bytes[0] != '%' ||
                bytes[1] != 'P' ||
                bytes[2] != 'D' ||
                bytes[3] != 'F' ||
                bytes[4] != '-') {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Only PDF files are supported");
        }

        Files.createDirectories(uploadDir);

        String storageName = UUID.randomUUID() + ".pdf";
        Path destination = uploadDir.resolve(storageName);

        Files.write(
                destination,
                bytes,
                StandardOpenOption.CREATE_NEW);

        Document document = new Document();

        document.subject = subject;
        document.title = title.trim();
        document.type = normalizedType;
        document.moduleNumber = selectedModule;
        document.examType = normalizedExamType;
        document.academicYear = normalizedYear;
        document.storageName = storageName;
        document.originalName = Optional
                .ofNullable(file.getOriginalFilename())
                .orElse("document.pdf");

        try {
            return documents.save(document);
        } catch (RuntimeException ex) {
            Files.deleteIfExists(destination);
            throw ex;
        }
    }

    // ---------- PDF VIEW / DOWNLOAD ----------

    @GetMapping("/documents/{id}/file")
    public ResponseEntity<Resource> getDocumentFile(
            @PathVariable Long id) throws Exception {

        Document document = documents.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Document not found"));

        Path path = uploadDir
                .resolve(document.storageName)
                .normalize();

        if (!path.startsWith(uploadDir)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid file path");
        }

        Resource resource = new UrlResource(path.toUri());

        if (!resource.exists() || !resource.isReadable()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "PDF file not found");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"document.pdf\"")
                .body(resource);
    }

    // ---------- DELETE DOCUMENT ----------

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable Long id) throws Exception {

        Document document = documents.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Document not found"));

        Path path = uploadDir
                .resolve(document.storageName)
                .normalize();

        if (!path.startsWith(uploadDir)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid file path");
        }

        documents.delete(document);
        Files.deleteIfExists(path);

        return ResponseEntity.noContent().build();
    }
}
