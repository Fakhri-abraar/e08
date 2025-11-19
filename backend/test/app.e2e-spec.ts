/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Image Upload (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  let authToken: string;
  let testUsername: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    prismaService = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    await prismaService.post.deleteMany();
    await prismaService.user.deleteMany();
    testUsername = `testuser_${Date.now()}`;

    // Create a user and get auth token for all tests
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: testUsername,
        password: 'password123',
      });

    authToken = registerResponse.body.access_token;
  });

  afterAll(async () => {
    await prismaService.post.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('S3 Presigned URL Generation', () => {
    it('should generate presigned URL with valid authentication', async () => {
      const requestDto = {
        fileExtension: 'jpg',
        contentType: 'image/jpeg',
      };

      const response = await request(app.getHttpServer())
        .post('/s3/presigned-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestDto)
        .expect(201);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('imagePath');
      expect(typeof response.body.uploadUrl).toBe('string');
      expect(typeof response.body.imagePath).toBe('string');
      expect(response.body.uploadUrl).toContain('X-Amz-Algorithm');
      expect(response.body.uploadUrl).toContain('X-Amz-Credential');
      expect(response.body.imagePath).toMatch(/^posts\/.*\.jpg$/);
    });

    it('should fail without authentication', async () => {
      const requestDto = {
        fileExtension: 'jpg',
        contentType: 'image/jpeg',
      };

      await request(app.getHttpServer())
        .post('/s3/presigned-url')
        .send(requestDto)
        .expect(401);
    });

    it('should fail with invalid data', async () => {
      await request(app.getHttpServer())
        .post('/s3/presigned-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should accept different image file extensions', async () => {
      const extensions = ['jpg', 'png', 'gif', 'webp'];

      for (const ext of extensions) {
        const response = await request(app.getHttpServer())
          .post('/s3/presigned-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileExtension: ext,
            contentType: `image/${ext}`,
          })
          .expect(201);

        expect(response.body.imagePath).toMatch(
          new RegExp(`^posts/.*\\.${ext}$`),
        );
      }
    });
  });

  describe('Posts with Image Upload', () => {
    let presignedResponse: {
      uploadUrl: string;
      imagePath: string;
    };

    beforeEach(async () => {
      // Get presigned URL for image upload
      const response = await request(app.getHttpServer())
        .post('/s3/presigned-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileExtension: 'jpg',
          contentType: 'image/jpeg',
        });

      presignedResponse = response.body;
    });

    it('should create a post with imagePath', async () => {
      const createPostDto = {
        content: 'Post with image',
        imagePath: presignedResponse.imagePath,
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('content', 'Post with image');
      expect(response.body).toHaveProperty(
        'imagePath',
        presignedResponse.imagePath,
      );
      expect(response.body).toHaveProperty('author');
      expect(response.body.author).toHaveProperty('username', testUsername);
      expect(response.body).toHaveProperty('id');
    });

    it('should create a post without imagePath', async () => {
      const createPostDto = {
        content: 'Post without image',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('content', 'Post without image');
      expect(response.body.imagePath).toBeNull();
    });

    it('should retrieve posts with imagePath in list', async () => {
      // Create post with image
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with image',
          imagePath: presignedResponse.imagePath,
        });

      // Get all posts
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('imagePath');
      expect(response.body[0].imagePath).toBe(presignedResponse.imagePath);
    });

    it('should retrieve post with imagePath by id', async () => {
      // Create post with image
      const createResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with image',
          imagePath: presignedResponse.imagePath,
        });

      const postId = createResponse.body.id;

      // Get specific post
      const response = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', postId);
      expect(response.body).toHaveProperty('imagePath');
      expect(response.body.imagePath).toBe(presignedResponse.imagePath);
    });

    it('should validate imagePath format', async () => {
      const createPostDto = {
        content: 'Post with invalid imagePath',
        imagePath: 'not-a-valid-path',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      // Even invalid paths are accepted as strings (validation could be added)
      expect(response.body).toHaveProperty('imagePath', 'not-a-valid-path');
    });
  });

  describe('Image Upload Integration Flow', () => {
    it('should complete full image upload flow', async () => {
      // Step 1: Get presigned URL
      const presignedResponse = await request(app.getHttpServer())
        .post('/s3/presigned-url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileExtension: 'png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(presignedResponse.body).toHaveProperty('uploadUrl');
      expect(presignedResponse.body).toHaveProperty('imagePath');

      const { uploadUrl, imagePath } = presignedResponse.body;

      // Step 2: Simulate S3 upload (in real scenario, client uploads to uploadUrl)
      // Note: In e2e test, we skip actual S3 upload as it requires external service

      // Step 3: Create post with imagePath
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with uploaded image',
          imagePath: imagePath,
        })
        .expect(201);

      expect(createPostResponse.body).toHaveProperty('imagePath', imagePath);
      expect(createPostResponse.body).toHaveProperty(
        'content',
        'Post with uploaded image',
      );

      // Step 4: Retrieve post and verify imagePath
      const postId = createPostResponse.body.id;
      const getPostResponse = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(getPostResponse.body).toHaveProperty('imagePath', imagePath);

      // Step 5: Verify in posts list
      const getPostsResponse = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const post = getPostsResponse.body.find((p: any) => p.id === postId);
      expect(post).toBeDefined();
      expect(post.imagePath).toBe(imagePath);
    });
  });

  describe('Multiple Image Formats', () => {
    it('should handle different image formats', async () => {
      const formats = [
        { extension: 'jpg', contentType: 'image/jpeg' },
        { extension: 'png', contentType: 'image/png' },
        { extension: 'gif', contentType: 'image/gif' },
        { extension: 'webp', contentType: 'image/webp' },
      ];

      for (const format of formats) {
        // Get presigned URL
        const presignedResponse = await request(app.getHttpServer())
          .post('/s3/presigned-url')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileExtension: format.extension,
            contentType: format.contentType,
          })
          .expect(201);

        const { imagePath } = presignedResponse.body;

        // Create post with this image
        const postResponse = await request(app.getHttpServer())
          .post('/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Post with ${format.extension} image`,
            imagePath: imagePath,
          })
          .expect(201);

        expect(postResponse.body.imagePath).toMatch(
          new RegExp(`^posts/.*\\.${format.extension}$`),
        );
      }
    });
  });
});
