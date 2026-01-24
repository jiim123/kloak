import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://kloak.lovable.app';
const DEFAULT_TITLE = 'Kloak - Private Communication Platform';
const SITE_NAME = 'Kloak';
const DEFAULT_IMAGE = `${BASE_URL}/favicon.png`;

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
}

/**
 * SEO Component for managing page-level meta tags
 * 
 * Usage:
 * - For homepage: <SEO /> (uses defaults)
 * - For other pages: <SEO title="Terms of Service" description="..." />
 */
export const SEO = ({
  title,
  description = 'Privacy-first communication platform. No email, no passwords, no tracking. Your conversations stay yours.',
  image = DEFAULT_IMAGE,
  type = 'website',
  noIndex = false,
}: SEOProps) => {
  const { pathname } = useLocation();
  const canonicalUrl = `${BASE_URL}${pathname}`;
  
  // Format title: "Page | Kloak - Private Communication Platform" or just the default
  const fullTitle = title 
    ? `${title} | ${DEFAULT_TITLE}` 
    : DEFAULT_TITLE;
  
  // Ensure image is absolute URL
  const absoluteImage = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Additional SEO tags */}
      <meta name="author" content="Kloak" />
      <meta name="theme-color" content="#0a0a0a" />
    </Helmet>
  );
};

export default SEO;
