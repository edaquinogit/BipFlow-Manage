import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuração do Swagger (Documentação Profissional)
  const config = new DocumentBuilder()
    .setTitle('BipFlow API')
    .setDescription('Documentação técnica da API de gestão BipFlow')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Habilita a validação global de dados (Essencial para segurança)
  app.useGlobalPipes(new ValidationPipe());

  // Habilita CORS (Para que o seu front-end consiga conversar com o back-end)
  app.enableCors();

  await app.listen(3000);
  console.log(`🚀 Server is running on: http://localhost:3000/api`);
}
bootstrap();