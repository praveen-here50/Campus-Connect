# Build with the JDK, run on the JRE. JDK 25 compiles both java.version 21 and 25.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /src/target/*.jar app.jar
USER app
EXPOSE 8080
# Sized for Render's free plan (512 MB), measured under load: the heap holds about 60 MB of live data,
# while Spring's classes need about 150 MB outside it. A 70% heap pushed the container to 506 MB and
# got it killed; with these settings it peaks around 410 MB.
ENV MALLOC_ARENA_MAX=2
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=35", "-XX:+UseSerialGC", "-Xss512k", "-XX:TieredStopAtLevel=1", \
            "-XX:ReservedCodeCacheSize=48m", "-XX:MaxMetaspaceSize=200m", "-jar", "app.jar"]
