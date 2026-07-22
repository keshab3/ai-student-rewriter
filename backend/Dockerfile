FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/target/*.jar app.jar

USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
