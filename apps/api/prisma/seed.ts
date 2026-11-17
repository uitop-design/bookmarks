import { createDb } from '../src/lib/db.js';

interface SeedBookmark {
  url: string;
  title: string;
  description: string;
  siteName: string;
  faviconUrl: string;
  tags: string[];
}

const bookmarks: SeedBookmark[] = [
  {
    url: 'https://developer.mozilla.org/en-US',
    title: 'MDN Web Docs',
    description:
      'The MDN Web Docs site provides information about Open Web technologies including HTML, CSS, and APIs for both Web sites and progressive web apps.',
    siteName: 'MDN Web Docs',
    faviconUrl: 'https://developer.mozilla.org/favicon.ico',
    tags: ['docs', 'web', 'javascript'],
  },
  {
    url: 'https://github.com/',
    title: 'GitHub',
    description:
      'GitHub is where people build software. Collaborate on code, review pull requests and ship with built-in CI/CD.',
    siteName: 'GitHub',
    faviconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
    tags: ['dev', 'git'],
  },
  {
    url: 'https://www.typescriptlang.org/docs',
    title: 'TypeScript Documentation',
    description:
      'Find TypeScript starter projects: from Angular to React or Node.js and CLIs. The handbook covers the type system from basics to advanced types.',
    siteName: 'TypeScript',
    faviconUrl: 'https://www.typescriptlang.org/favicon-32x32.png',
    tags: ['docs', 'typescript', 'javascript'],
  },
  {
    url: 'https://react.dev/',
    title: 'React',
    description:
      'React is the library for web and native user interfaces. Build user interfaces out of individual pieces called components written in JavaScript.',
    siteName: 'React',
    faviconUrl: 'https://react.dev/favicon-32x32.png',
    tags: ['web', 'javascript', 'frontend'],
  },
  {
    url: 'https://fastify.dev/',
    title: 'Fastify — fast and low overhead web framework for Node.js',
    description:
      'Fastify is a web framework highly focused on providing the best developer experience with the least overhead and a powerful plugin architecture.',
    siteName: 'Fastify',
    faviconUrl: 'https://fastify.dev/img/favicon.ico',
    tags: ['node', 'backend', 'javascript'],
  },
  {
    url: 'https://www.postgresql.org/docs/current/textsearch.html',
    title: 'PostgreSQL: Documentation: Full Text Search',
    description:
      'Full text searching provides the capability to identify natural-language documents that satisfy a query, and optionally to sort them by relevance.',
    siteName: 'PostgreSQL Documentation',
    faviconUrl: 'https://www.postgresql.org/favicon.ico',
    tags: ['docs', 'database', 'search'],
  },
  {
    url: 'https://www.prisma.io/docs',
    title: 'Prisma Documentation',
    description:
      'Get started with Prisma ORM: a type-safe database client, declarative migrations and a schema language for Node.js and TypeScript.',
    siteName: 'Prisma',
    faviconUrl: 'https://www.prisma.io/favicon.ico',
    tags: ['docs', 'database', 'typescript'],
  },
  {
    url: 'https://tailwindcss.com/',
    title: 'Tailwind CSS - Rapidly build modern websites without ever leaving your HTML',
    description:
      'A utility-first CSS framework packed with classes like flex, pt-4, text-center and rotate-90 that can be composed to build any design, directly in your markup.',
    siteName: 'Tailwind CSS',
    faviconUrl: 'https://tailwindcss.com/favicons/favicon-32x32.png',
    tags: ['css', 'frontend', 'web'],
  },
  {
    url: 'https://ui.shadcn.com/',
    title: 'shadcn/ui',
    description:
      'A set of beautifully designed components that you can customize, extend, and build on. Start here then make it your own. Open Source. Open Code.',
    siteName: 'shadcn/ui',
    faviconUrl: 'https://ui.shadcn.com/favicon.ico',
    tags: ['frontend', 'design', 'react'],
  },
  {
    url: 'https://news.ycombinator.com/',
    title: 'Hacker News',
    description:
      'Social news website focusing on computer science and entrepreneurship, run by the startup incubator Y Combinator.',
    siteName: 'Hacker News',
    faviconUrl: 'https://news.ycombinator.com/favicon.ico',
    tags: ['news', 'reading'],
  },
  {
    url: 'https://www.figma.com/',
    title: 'Figma: The Collaborative Interface Design Tool',
    description:
      'Figma is the leading collaborative design tool for building meaningful products. Design, prototype, and gather feedback all in one place.',
    siteName: 'Figma',
    faviconUrl: 'https://static.figma.com/app/icon/1/favicon.png',
    tags: ['design', 'tools'],
  },
  {
    url: 'https://web.dev/learn',
    title: 'Learn web development | web.dev',
    description:
      'Courses on HTML, CSS, accessibility, performance and more, written by experts to help you build modern web experiences that work for everyone.',
    siteName: 'web.dev',
    faviconUrl: 'https://web.dev/_pwa/web/icons/icon-144x144.png',
    tags: ['web', 'reading', 'frontend'],
  },
  {
    url: 'https://nodejs.org/en',
    title: 'Node.js — Run JavaScript Everywhere',
    description:
      'Node.js is a free, open-source, cross-platform JavaScript runtime environment that lets developers create servers, web apps, command line tools and scripts.',
    siteName: 'Node.js',
    faviconUrl: 'https://nodejs.org/static/images/favicons/favicon.png',
    tags: ['node', 'backend', 'javascript'],
  },
  {
    url: 'https://www.docker.com/',
    title: 'Docker: Accelerated Container Application Development',
    description:
      'Docker is a platform designed to help developers build, share, and run container applications. We handle the tedious setup, so you can focus on the code.',
    siteName: 'Docker',
    faviconUrl: 'https://www.docker.com/app/uploads/2024/02/cropped-docker-logo-favicon-32x32.png',
    tags: ['devops', 'tools'],
  },
  {
    url: 'https://www.smashingmagazine.com/',
    title: 'Smashing Magazine — For Web Designers And Developers',
    description:
      'Magazine on CSS, JavaScript, front-end, accessibility, UX and design. For developers, designers and front-end engineers.',
    siteName: 'Smashing Magazine',
    faviconUrl: 'https://www.smashingmagazine.com/images/favicon/favicon.svg',
    tags: ['design', 'reading', 'css'],
  },
];

const SEED_START = Date.parse('2026-11-01T09:00:00Z');
const HOUR = 60 * 60 * 1000;

const db = createDb(process.env.DATABASE_URL ?? '');

try {
  const tagNames = [...new Set(bookmarks.flatMap(({ tags }) => tags))];
  const tagIds = new Map<string, string>();
  for (const name of tagNames) {
    const tag = await db.tag.upsert({ where: { name }, create: { name }, update: {} });
    tagIds.set(name, tag.id);
  }

  for (const [index, { tags, ...bookmark }] of bookmarks.entries()) {
    const data = { ...bookmark, metadataStatus: 'OK' as const };
    const tagLinks = tags.map((name) => ({ tagId: tagIds.get(name) ?? '' }));
    await db.bookmark.upsert({
      where: { url: bookmark.url },
      create: {
        ...data,
        createdAt: new Date(SEED_START + index * 7 * HOUR),
        tags: { create: tagLinks },
      },
      update: { ...data, tags: { deleteMany: {}, create: tagLinks } },
    });
  }
  await db.tag.deleteMany({ where: { bookmarks: { none: {} } } });

  console.log(`Seeded ${bookmarks.length} bookmarks and ${tagNames.length} tags`);
} finally {
  await db.$disconnect();
}
