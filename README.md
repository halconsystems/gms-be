<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## User Management

### Service Number-Based User Creation

The application now supports creating user accounts for both employees and guards using their service numbers. This feature ensures proper user management within organizations.

#### Overview

Users can now be created for both employees and guards using their unique service numbers. The system validates that:
- Service numbers are unique within an organization and person type combination
- The person (employee/guard) exists in the organization
- The person doesn't already have a user account
- The email address is unique across all users

#### API Endpoint

```http
POST /users/create-by-service-number
Authorization: Bearer {jwt_token}

{
  "serviceNumber": 1001,
  "personType": "EMPLOYEE",  // or "GUARD"
  "officeId": "123e4567-e89b-12d3-a456-426614174000",
  "email": "john.doe@example.com",
  "password": "password123",
  "userName": "johndoe",
  "profileImage": "profile.jpg",  // optional
  "roleId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Response

```json
{
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "john.doe@example.com",
      "userName": "johndoe",
      ...
    },
    "person": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "fullName": "John Doe",
      "serviceNumber": 1001,
      ...
    }
  }
}
```

#### Migration Notes

The Guard model now supports user accounts via the `userId` field, similar to the Employee model. This enables guards to have login credentials and access the system based on their assigned roles.

#### Service Number Scoping

Service numbers are unique within the combination of:
- Organization
- Person type (Employee or Guard)

This means an employee and a guard in the same organization can have the same service number, but two employees or two guards in the same organization cannot.

#### Backward Compatibility

The previous endpoint `POST /users/create` for creating employee users using `employeeId` is still maintained for backward compatibility.

## Project setup

```bash
$ npm install

# Generate Prisma client
$ npx prisma generate

# Apply database migrations
$ npx prisma migrate deploy    # For production/staging
$ npx prisma migrate dev      # For development (creates new migrations)

# Seed the database (if needed)
$ npx prisma db seed
```

### Database Migrations

When working with database changes:

1. Development environment:
   ```bash
   # Create and apply a new migration
   $ npx prisma migrate dev --name <descriptive_name>
   ```

2. Staging/Production environment:
   ```bash
   # Apply existing migrations without modifications
   $ npx prisma migrate deploy
   ```

3. After any schema changes:
   ```bash
   # Update Prisma client
   $ npx prisma generate
   ```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
