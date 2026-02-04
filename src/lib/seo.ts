/**
 * SEO Configuration for Kloak
 * 
 * Centralized metadata definitions for all public pages.
 * Descriptions are optimized for 150-160 characters.
 */

export const SEO_CONFIG = {
  home: {
    title: undefined, // Uses default "Kloak - Private Communication Platform"
    description: 'Privacy-first communication platform. No email, no passwords, no tracking. Your conversations belong to you. Join the movement for true digital privacy.',
  },
  
  terms: {
    title: 'Terms of Service',
    description: 'Kloak Terms of Service. Fair, readable terms that respect your rights. No hidden gotchas, no 50-page legal documents. Clear expectations for everyone.',
  },
  
  privacy: {
    title: 'Privacy Policy',
    description: 'Kloak Privacy Policy. We collect only what\'s essential. No email, no phone, no tracking. Privacy isn\'t a feature here—it\'s the architecture.',
  },
  
  cookies: {
    title: 'Cookie Policy',
    description: 'Kloak Cookie Policy. Only essential cookies for authentication and preferences. No tracking, no ads, no third-party analytics. Just what\'s necessary.',
  },
  
  philosophy: {
    title: 'Our Philosophy',
    description: 'Why we built Kloak: communication should be private. Not tracked, analyzed, or sold. Ever. Learn about our commitment to privacy-first architecture.',
  },
  
  faq: {
    title: 'FAQ',
    description: 'Frequently asked questions about Kloak. Learn about our privacy-first approach, secret key authentication, and how to use the platform.',
  },
  
  auth: {
    title: 'Sign In',
    description: 'Sign in to Kloak with your secret key. No email, no password—just cryptographic security. Your identity, fully under your control.',
  },
  
  invite: {
    title: 'Server Invite',
    description: 'You\'ve been invited to join a private server on Kloak. Join the conversation on the privacy-first communication platform.',
  },
  
  notFound: {
    title: 'Page Not Found',
    description: 'The page you\'re looking for doesn\'t exist. Return to Kloak and continue your private conversations.',
  },
} as const;

export type SEOPageKey = keyof typeof SEO_CONFIG;
