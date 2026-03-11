###############
# OWL2VOWL    #
###############

# Stage 1: Build
FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /build

# Copy wrapper and pom.xml first for dependency caching
COPY OWL2VOWL/.mvn .mvn
COPY OWL2VOWL/mvnw ./
COPY OWL2VOWL/pom.xml ./
RUN ./mvnw dependency:go-offline -B -P war-release 2>/dev/null || true

# Copy source and build
COPY OWL2VOWL/src ./src
RUN ./mvnw package -DskipTests -B -P war-release

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

COPY --from=builder /build/target/owl2vowl.war owl2vowl.war

EXPOSE 8080
CMD ["java", "-jar", "owl2vowl.war"]
