###############
# OWL2VOWL    #
###############

# Stage 1: Build
FROM maven:3.8.8-eclipse-temurin-8 AS builder
WORKDIR /build

# Copy pom.xml first for dependency caching
COPY OWL2VOWL/pom.xml ./
RUN mvn dependency:go-offline -B -P war-release 2>/dev/null || true

# Copy source and build
COPY OWL2VOWL/src ./src
RUN mvn package -DskipTests -B -P war-release

# Stage 2: Runtime
FROM amazoncorretto:8-alpine
WORKDIR /app

COPY --from=builder /build/target/owl2vowl.war owl2vowl.war

EXPOSE 8080
CMD ["java", "-jar", "owl2vowl.war"]
