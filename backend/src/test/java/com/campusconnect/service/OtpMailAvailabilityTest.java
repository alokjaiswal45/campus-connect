package com.campusconnect.service;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OtpMailAvailabilityTest {
    @Test void rejectsGmailAuthenticationFailureBeforeAnyAccountLookupOrCodeSend() throws Exception {
        JavaMailSenderImpl smtp = mock(JavaMailSenderImpl.class);
        doThrow(new AuthenticationFailedException("535 test rejection")).when(smtp).testConnection();
        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> new OtpMailAvailability(smtp).ensureReady());
        assertEquals("Email service is temporarily unavailable.", failure.getMessage());
        assertNull(failure.getCause());
        verify(smtp).testConnection();
        verifyNoMoreInteractions(smtp);
    }
    @Test void connectionFailuresAlsoProduceSafeAvailabilityErrors() throws Exception {
        JavaMailSenderImpl smtp = mock(JavaMailSenderImpl.class);
        doThrow(new MessagingException("test timeout")).when(smtp).testConnection();
        assertThrows(IllegalStateException.class, () -> new OtpMailAvailability(smtp).ensureReady());
    }
    @Test void healthySenderCanContinueWithoutSendingATestEmail() throws Exception {
        JavaMailSenderImpl smtp = mock(JavaMailSenderImpl.class);
        assertDoesNotThrow(() -> new OtpMailAvailability(smtp).ensureReady());
        verify(smtp).testConnection();
        verifyNoMoreInteractions(smtp);
    }
}
