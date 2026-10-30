package com.campusconnect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;

/** Starts the whole application, so it needs a database: runs only when DB_URL is set. */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
