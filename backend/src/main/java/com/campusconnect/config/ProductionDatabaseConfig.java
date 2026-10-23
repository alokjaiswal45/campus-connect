package com.campusconnect.config;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("prod")
public class ProductionDatabaseConfig {
    @Bean
    SmartInitializingSingleton rejectRootDatabaseAccount(DataSourceProperties properties) {
        return () -> {
            if ("root".equalsIgnoreCase(properties.determineUsername())) {
                throw new IllegalStateException("Use a dedicated application database account in production, not root.");
            }
        };
    }
}
