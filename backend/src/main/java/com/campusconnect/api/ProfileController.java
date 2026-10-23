package com.campusconnect.api;

import com.campusconnect.model.*;
import com.campusconnect.repo.*;
import java.io.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final UserRepository users;
    private final AccountProfileRepository profiles;
    public ProfileController(UserRepository users, AccountProfileRepository profiles) {
        this.users = users; this.profiles = profiles;
    }
    public record Details(Long id, String name, String email, String role, boolean emailVerified,
            boolean accountActive, String department, String about, boolean hasPhoto) {}
    public record Update(String name, String department, String about) {}
    private User owner(Authentication auth, boolean lock) {
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        User user = (lock ? users.lockByEmail(auth.getName()) : users.findByEmailIgnoreCase(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!user.isAccountActive()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }
    private AccountProfile profile(User user) {
        return profiles.findById(user.getId()).orElseGet(() -> {
            AccountProfile profile = new AccountProfile(); profile.userId = user.getId(); return profile;
        });
    }
    private Details details(User user, AccountProfile profile) {
        return new Details(user.getId(), user.getName(), user.getEmail(), user.getRole(),
                user.isEmailVerified(), user.isAccountActive(), profile.department, profile.about,
                profile.photo != null && profile.photo.length > 0);
    }
    @GetMapping public Details get(Authentication auth) {
        User user = owner(auth, false); return details(user, profile(user));
    }
    @PutMapping @Transactional
    public Details update(@RequestBody Update request, Authentication auth) {
        if (request == null || request.name() == null || request.name().isBlank()
                || request.name().length() > 100 || request.department() != null && request.department().length() > 120
                || request.about() != null && request.about().length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use a name up to 100 characters, department up to 120 and about up to 500.");
        }
        User user = owner(auth, true); AccountProfile profile = profile(user);
        user.setName(request.name().trim());
        profile.department = request.department() == null ? "" : request.department().trim();
        profile.about = request.about() == null ? "" : request.about().trim();
        users.save(user); profiles.save(profile); return details(user, profile);
    }
    @GetMapping("/photo")
    public ResponseEntity<byte[]> photo(Authentication auth) {
        AccountProfile profile = profile(owner(auth, false));
        if (profile.photo == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff").body(profile.photo);
    }
    @PostMapping("/photo") @Transactional
    public Details upload(@RequestParam("file") MultipartFile file, Authentication auth) throws IOException {
        User user = owner(auth, true);
        if (file.isEmpty() || file.getSize() > 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a JPEG or PNG up to 1 MB.");
        }
        byte[] sanitized;
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IOException("Invalid image");
            var reader = readers.next();
            try {
                reader.setInput(input);
                String format = reader.getFormatName();
                if (!("JPEG".equalsIgnoreCase(format) || "PNG".equalsIgnoreCase(format))
                        || reader.getWidth(0) > 2048 || reader.getHeight(0) > 2048) throw new IOException("Unsupported image");
                BufferedImage image = reader.read(0);
                int width = image.getWidth(), height = image.getHeight();
                double scale = Math.min(1.0, 512.0 / Math.max(width, height));
                BufferedImage resized = new BufferedImage(Math.max(1, (int)(width * scale)),
                        Math.max(1, (int)(height * scale)), BufferedImage.TYPE_INT_ARGB);
                var graphics = resized.createGraphics();
                try { graphics.drawImage(image, 0, 0, resized.getWidth(), resized.getHeight(), null); }
                finally { graphics.dispose(); }
                var output = new ByteArrayOutputStream(); ImageIO.write(resized, "png", output);
                sanitized = output.toByteArray();
            } finally { reader.dispose(); }
        } catch (IOException | RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid JPEG or PNG, up to 1 MB and 2048 × 2048 pixels.");
        }
        AccountProfile profile = profile(user); profile.photo = sanitized;
        profiles.save(profile); return details(user, profile);
    }
    @DeleteMapping("/photo") @Transactional
    public Details remove(Authentication auth) {
        User user = owner(auth, true); AccountProfile profile = profile(user);
        profile.photo = null; profiles.save(profile); return details(user, profile);
    }
}
