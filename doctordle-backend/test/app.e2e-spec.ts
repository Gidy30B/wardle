import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/case/today (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/case/today')
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('diagnosis');
      });
  });

  it('/api/guess (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/guess')
      .send({ guess: 'heart attack' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toHaveProperty('result');
        expect(response.body).toHaveProperty('score');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
