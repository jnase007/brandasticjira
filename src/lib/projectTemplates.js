// Project Templates for Brandastic Services
// These templates can be used to quickly spin up new client projects

export const PROJECT_TEMPLATES = [
  // ===== BRAND DEVELOPMENT =====
  {
    id: 'discovery-strategy',
    name: 'Discovery & Strategy',
    category: 'Brand Development',
    icon: '🔍',
    color: '#8B5CF6', // Purple
    description: 'Initial discovery phase for new clients',
    estimatedHours: 20,
    tasks: [
      { title: 'Client kickoff meeting', priority: 'high', estimate: 2 },
      { title: 'Send client questionnaire', priority: 'high', estimate: 0.5 },
      { title: 'Review questionnaire responses', priority: 'medium', estimate: 1 },
      { title: 'Competitor analysis', priority: 'high', estimate: 4 },
      { title: 'Market research & trends', priority: 'medium', estimate: 3 },
      { title: 'Target audience personas', priority: 'medium', estimate: 2 },
      { title: 'SWOT analysis', priority: 'medium', estimate: 1.5 },
      { title: 'Brand positioning statement', priority: 'high', estimate: 2 },
      { title: 'Strategy presentation deck', priority: 'high', estimate: 3 },
      { title: 'Strategy presentation meeting', priority: 'high', estimate: 1 },
    ]
  },
  {
    id: 'branding',
    name: 'Branding Package',
    category: 'Brand Development',
    icon: '🎨',
    color: '#EC4899', // Pink
    description: 'Complete brand identity development',
    estimatedHours: 40,
    tasks: [
      { title: 'Creative brief & mood board', priority: 'high', estimate: 3 },
      { title: 'Logo concepts - Round 1 (3 options)', priority: 'high', estimate: 8 },
      { title: 'Logo presentation meeting', priority: 'high', estimate: 1 },
      { title: 'Logo refinements - Round 2', priority: 'medium', estimate: 4 },
      { title: 'Final logo approval', priority: 'high', estimate: 1 },
      { title: 'Color palette development', priority: 'medium', estimate: 2 },
      { title: 'Typography selection', priority: 'medium', estimate: 1.5 },
      { title: 'Brand patterns & graphics', priority: 'low', estimate: 3 },
      { title: 'Brand guidelines document', priority: 'high', estimate: 6 },
      { title: 'Logo file package (all formats)', priority: 'high', estimate: 2 },
      { title: 'Brand assets handoff', priority: 'medium', estimate: 1 },
    ]
  },
  {
    id: 'photo-video',
    name: 'Photography & Videography',
    category: 'Brand Development',
    icon: '📸',
    color: '#F59E0B', // Amber
    description: 'Photo and video production',
    estimatedHours: 30,
    tasks: [
      { title: 'Creative concept development', priority: 'high', estimate: 2 },
      { title: 'Shot list creation', priority: 'high', estimate: 2 },
      { title: 'Location scouting', priority: 'medium', estimate: 2 },
      { title: 'Talent/model coordination', priority: 'medium', estimate: 1 },
      { title: 'Equipment & props preparation', priority: 'medium', estimate: 1 },
      { title: 'Photo shoot day', priority: 'high', estimate: 8 },
      { title: 'Video shoot day', priority: 'high', estimate: 8 },
      { title: 'Photo selection & culling', priority: 'medium', estimate: 2 },
      { title: 'Photo editing & retouching', priority: 'high', estimate: 6 },
      { title: 'Video editing & post-production', priority: 'high', estimate: 12 },
      { title: 'Client review & revisions', priority: 'medium', estimate: 2 },
      { title: 'Final delivery', priority: 'high', estimate: 1 },
    ]
  },
  {
    id: 'marketing-collateral',
    name: 'Marketing Collateral',
    category: 'Brand Development',
    icon: '📄',
    color: '#10B981', // Emerald
    description: 'Print and digital marketing materials',
    estimatedHours: 25,
    tasks: [
      { title: 'Collateral needs assessment', priority: 'high', estimate: 1 },
      { title: 'Business card design', priority: 'medium', estimate: 2 },
      { title: 'Letterhead & envelope design', priority: 'low', estimate: 1.5 },
      { title: 'Email signature design', priority: 'low', estimate: 0.5 },
      { title: 'Brochure/flyer design', priority: 'medium', estimate: 4 },
      { title: 'Presentation template', priority: 'medium', estimate: 3 },
      { title: 'Social media templates', priority: 'medium', estimate: 3 },
      { title: 'Trade show/banner design', priority: 'low', estimate: 2 },
      { title: 'Print file preparation', priority: 'high', estimate: 2 },
      { title: 'Vendor coordination', priority: 'medium', estimate: 1 },
    ]
  },

  // ===== WEB DESIGN & DEVELOPMENT =====
  {
    id: 'wordpress-website',
    name: 'WordPress Website',
    category: 'Web Design & Development',
    icon: '💻',
    color: '#3B82F6', // Blue
    description: 'Full WordPress website build',
    estimatedHours: 80,
    tasks: [
      { title: 'Technical requirements gathering', priority: 'high', estimate: 2 },
      { title: 'Sitemap & content structure', priority: 'high', estimate: 3 },
      { title: 'Wireframes - key pages', priority: 'high', estimate: 6 },
      { title: 'Wireframe approval meeting', priority: 'high', estimate: 1 },
      { title: 'Homepage design mockup', priority: 'high', estimate: 8 },
      { title: 'Interior page designs', priority: 'high', estimate: 10 },
      { title: 'Mobile responsive designs', priority: 'high', estimate: 4 },
      { title: 'Design approval meeting', priority: 'high', estimate: 1 },
      { title: 'WordPress setup & configuration', priority: 'high', estimate: 2 },
      { title: 'Theme development', priority: 'high', estimate: 16 },
      { title: 'Plugin setup & configuration', priority: 'medium', estimate: 3 },
      { title: 'Content migration/entry', priority: 'medium', estimate: 8 },
      { title: 'Forms & integrations setup', priority: 'medium', estimate: 3 },
      { title: 'SEO setup (Yoast/RankMath)', priority: 'medium', estimate: 2 },
      { title: 'Cross-browser testing', priority: 'high', estimate: 2 },
      { title: 'Mobile/tablet testing', priority: 'high', estimate: 2 },
      { title: 'Performance optimization', priority: 'medium', estimate: 2 },
      { title: 'Security hardening', priority: 'high', estimate: 1 },
      { title: 'Client training session', priority: 'medium', estimate: 2 },
      { title: 'Launch checklist & go-live', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'shopify-website',
    name: 'Shopify E-commerce',
    category: 'Web Design & Development',
    icon: '🛒',
    color: '#84CC16', // Lime
    description: 'Shopify store build',
    estimatedHours: 70,
    tasks: [
      { title: 'E-commerce requirements gathering', priority: 'high', estimate: 2 },
      { title: 'Product catalog planning', priority: 'high', estimate: 2 },
      { title: 'Shopify account setup', priority: 'high', estimate: 1 },
      { title: 'Theme selection/purchase', priority: 'high', estimate: 1 },
      { title: 'Homepage design mockup', priority: 'high', estimate: 6 },
      { title: 'Collection page design', priority: 'high', estimate: 3 },
      { title: 'Product page design', priority: 'high', estimate: 4 },
      { title: 'Cart & checkout customization', priority: 'high', estimate: 3 },
      { title: 'Theme customization & development', priority: 'high', estimate: 12 },
      { title: 'Product import/setup', priority: 'medium', estimate: 6 },
      { title: 'Collection organization', priority: 'medium', estimate: 2 },
      { title: 'Payment gateway setup', priority: 'high', estimate: 2 },
      { title: 'Shipping rates configuration', priority: 'high', estimate: 2 },
      { title: 'Tax settings', priority: 'medium', estimate: 1 },
      { title: 'Email notification setup', priority: 'medium', estimate: 2 },
      { title: 'App integrations', priority: 'medium', estimate: 3 },
      { title: 'Test orders & checkout flow', priority: 'high', estimate: 2 },
      { title: 'Client training session', priority: 'medium', estimate: 2 },
      { title: 'Launch & DNS setup', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'ui-ux-design',
    name: 'UI/UX Design',
    category: 'Web Design & Development',
    icon: '✨',
    color: '#A855F7', // Purple
    description: 'User interface and experience design',
    estimatedHours: 35,
    tasks: [
      { title: 'User research & interviews', priority: 'high', estimate: 4 },
      { title: 'User personas development', priority: 'high', estimate: 2 },
      { title: 'User journey mapping', priority: 'high', estimate: 3 },
      { title: 'Information architecture', priority: 'high', estimate: 3 },
      { title: 'Low-fidelity wireframes', priority: 'high', estimate: 4 },
      { title: 'Wireframe testing & feedback', priority: 'medium', estimate: 2 },
      { title: 'High-fidelity mockups', priority: 'high', estimate: 8 },
      { title: 'Interactive prototype (Figma)', priority: 'medium', estimate: 4 },
      { title: 'Usability testing', priority: 'medium', estimate: 3 },
      { title: 'Design system/component library', priority: 'medium', estimate: 4 },
      { title: 'Developer handoff', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'cro',
    name: 'Conversion Rate Optimization',
    category: 'Web Design & Development',
    icon: '📈',
    color: '#EF4444', // Red
    description: 'CRO audit and implementation',
    estimatedHours: 25,
    tasks: [
      { title: 'Google Analytics audit', priority: 'high', estimate: 2 },
      { title: 'Heatmap & session recording setup', priority: 'high', estimate: 1 },
      { title: 'Conversion funnel analysis', priority: 'high', estimate: 3 },
      { title: 'User behavior analysis', priority: 'high', estimate: 3 },
      { title: 'Competitor conversion analysis', priority: 'medium', estimate: 2 },
      { title: 'CRO recommendations report', priority: 'high', estimate: 4 },
      { title: 'A/B test planning', priority: 'high', estimate: 2 },
      { title: 'Landing page optimization', priority: 'high', estimate: 4 },
      { title: 'Form optimization', priority: 'medium', estimate: 2 },
      { title: 'CTA testing & refinement', priority: 'medium', estimate: 2 },
      { title: 'Results analysis & reporting', priority: 'high', estimate: 2 },
    ]
  },

  // ===== DIGITAL MARKETING =====
  {
    id: 'seo-campaign',
    name: 'SEO Campaign',
    category: 'Digital Marketing',
    icon: '🔎',
    color: '#14B8A6', // Teal
    description: 'Search engine optimization campaign',
    estimatedHours: 30,
    tasks: [
      { title: 'Technical SEO audit', priority: 'high', estimate: 4 },
      { title: 'Keyword research & strategy', priority: 'high', estimate: 4 },
      { title: 'Competitor SEO analysis', priority: 'high', estimate: 3 },
      { title: 'On-page optimization plan', priority: 'high', estimate: 2 },
      { title: 'Meta titles & descriptions', priority: 'high', estimate: 3 },
      { title: 'Header tag optimization', priority: 'medium', estimate: 2 },
      { title: 'Internal linking strategy', priority: 'medium', estimate: 2 },
      { title: 'Content gap analysis', priority: 'medium', estimate: 2 },
      { title: 'Blog content calendar', priority: 'medium', estimate: 2 },
      { title: 'Local SEO setup (GMB)', priority: 'medium', estimate: 2 },
      { title: 'Backlink outreach', priority: 'low', estimate: 4 },
      { title: 'Monthly ranking report', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'ppc-campaign',
    name: 'PPC Campaign',
    category: 'Digital Marketing',
    icon: '💰',
    color: '#F97316', // Orange
    description: 'Pay-per-click advertising campaign',
    estimatedHours: 35,
    tasks: [
      { title: 'Account audit (if existing)', priority: 'high', estimate: 2 },
      { title: 'Campaign strategy & goals', priority: 'high', estimate: 2 },
      { title: 'Keyword research - PPC', priority: 'high', estimate: 3 },
      { title: 'Competitor ad analysis', priority: 'medium', estimate: 2 },
      { title: 'Campaign structure planning', priority: 'high', estimate: 2 },
      { title: 'Ad copy writing (search ads)', priority: 'high', estimate: 4 },
      { title: 'Display ad design', priority: 'medium', estimate: 3 },
      { title: 'Landing page recommendations', priority: 'high', estimate: 2 },
      { title: 'Conversion tracking setup', priority: 'high', estimate: 2 },
      { title: 'Google Ads account setup', priority: 'high', estimate: 2 },
      { title: 'Campaign build & launch', priority: 'high', estimate: 3 },
      { title: 'Audience targeting setup', priority: 'medium', estimate: 2 },
      { title: 'Remarketing campaign setup', priority: 'medium', estimate: 2 },
      { title: 'Bid strategy optimization', priority: 'medium', estimate: 2 },
      { title: 'Weekly performance review', priority: 'high', estimate: 1 },
      { title: 'Monthly performance report', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'social-media-marketing',
    name: 'Social Media Marketing',
    category: 'Digital Marketing',
    icon: '📱',
    color: '#6366F1', // Indigo
    description: 'Monthly social media management',
    estimatedHours: 20,
    tasks: [
      { title: 'Social media audit', priority: 'high', estimate: 2 },
      { title: 'Platform strategy', priority: 'high', estimate: 2 },
      { title: 'Content calendar creation', priority: 'high', estimate: 3 },
      { title: 'Content creation - graphics', priority: 'medium', estimate: 4 },
      { title: 'Copywriting - captions', priority: 'medium', estimate: 2 },
      { title: 'Hashtag research', priority: 'low', estimate: 1 },
      { title: 'Post scheduling', priority: 'medium', estimate: 1 },
      { title: 'Community management', priority: 'medium', estimate: 2 },
      { title: 'Engagement & replies', priority: 'medium', estimate: 2 },
      { title: 'Analytics & reporting', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'programmatic-marketing',
    name: 'Programmatic Marketing',
    category: 'Digital Marketing',
    icon: '🤖',
    color: '#0EA5E9', // Sky
    description: 'Programmatic advertising campaign',
    estimatedHours: 25,
    tasks: [
      { title: 'Audience strategy & targeting', priority: 'high', estimate: 3 },
      { title: 'DSP platform selection', priority: 'high', estimate: 1 },
      { title: 'Creative asset requirements', priority: 'high', estimate: 1 },
      { title: 'Display ad design (multiple sizes)', priority: 'high', estimate: 4 },
      { title: 'Native ad creation', priority: 'medium', estimate: 2 },
      { title: 'Video ad production', priority: 'medium', estimate: 4 },
      { title: 'Campaign setup & launch', priority: 'high', estimate: 3 },
      { title: 'Pixel/tracking implementation', priority: 'high', estimate: 2 },
      { title: 'Bid optimization', priority: 'medium', estimate: 2 },
      { title: 'Weekly performance check', priority: 'medium', estimate: 1 },
      { title: 'Monthly reporting', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'content-marketing',
    name: 'Content Marketing',
    category: 'Digital Marketing',
    icon: '✍️',
    color: '#22C55E', // Green
    description: 'Content strategy and creation',
    estimatedHours: 30,
    tasks: [
      { title: 'Content audit', priority: 'high', estimate: 3 },
      { title: 'Content strategy development', priority: 'high', estimate: 3 },
      { title: 'Editorial calendar creation', priority: 'high', estimate: 2 },
      { title: 'Topic research & ideation', priority: 'medium', estimate: 2 },
      { title: 'Blog post writing (x4)', priority: 'high', estimate: 8 },
      { title: 'Blog post editing & review', priority: 'medium', estimate: 2 },
      { title: 'SEO optimization for content', priority: 'medium', estimate: 2 },
      { title: 'Featured image creation', priority: 'low', estimate: 2 },
      { title: 'Content publishing', priority: 'medium', estimate: 1 },
      { title: 'Content promotion plan', priority: 'medium', estimate: 2 },
      { title: 'Performance analytics', priority: 'high', estimate: 2 },
    ]
  },
  {
    id: 'sem-campaign',
    name: 'Search Engine Marketing',
    category: 'Digital Marketing',
    icon: '🎯',
    color: '#DC2626', // Red
    description: 'Comprehensive SEM campaign',
    estimatedHours: 40,
    tasks: [
      { title: 'SEM strategy & goals', priority: 'high', estimate: 2 },
      { title: 'Keyword research - comprehensive', priority: 'high', estimate: 4 },
      { title: 'Competitor analysis', priority: 'high', estimate: 3 },
      { title: 'Campaign architecture', priority: 'high', estimate: 2 },
      { title: 'Ad copy creation', priority: 'high', estimate: 4 },
      { title: 'Ad extensions setup', priority: 'medium', estimate: 1 },
      { title: 'Landing page audit', priority: 'high', estimate: 2 },
      { title: 'Conversion tracking', priority: 'high', estimate: 2 },
      { title: 'Google Ads build', priority: 'high', estimate: 4 },
      { title: 'Microsoft Ads build', priority: 'medium', estimate: 3 },
      { title: 'Audience targeting', priority: 'medium', estimate: 2 },
      { title: 'Remarketing lists', priority: 'medium', estimate: 2 },
      { title: 'Quality Score optimization', priority: 'medium', estimate: 2 },
      { title: 'A/B testing setup', priority: 'medium', estimate: 2 },
      { title: 'Bid management', priority: 'medium', estimate: 2 },
      { title: 'Monthly reporting & insights', priority: 'high', estimate: 3 },
    ]
  },
  {
    id: 'consulting',
    name: 'Marketing Consulting',
    category: 'Digital Marketing',
    icon: '💡',
    color: '#FBBF24', // Amber
    description: 'Strategic marketing consulting',
    estimatedHours: 15,
    tasks: [
      { title: 'Discovery session', priority: 'high', estimate: 2 },
      { title: 'Current marketing audit', priority: 'high', estimate: 3 },
      { title: 'Market & competitor research', priority: 'high', estimate: 3 },
      { title: 'Strategic recommendations', priority: 'high', estimate: 4 },
      { title: 'Action plan development', priority: 'high', estimate: 2 },
      { title: 'Presentation & handoff', priority: 'high', estimate: 1 },
    ]
  },

  // ===== ONGOING/MONTHLY =====
  {
    id: 'monthly-retainer',
    name: 'Monthly Retainer',
    category: 'Ongoing',
    icon: '🔄',
    color: '#64748B', // Slate
    description: 'Standard monthly retainer tasks',
    estimatedHours: 20,
    tasks: [
      { title: 'Monthly strategy call', priority: 'high', estimate: 1 },
      { title: 'Performance review & analysis', priority: 'high', estimate: 2 },
      { title: 'Monthly report creation', priority: 'high', estimate: 2 },
      { title: 'Report presentation meeting', priority: 'high', estimate: 1 },
      { title: 'Action items from last month', priority: 'medium', estimate: 4 },
      { title: 'Optimization tasks', priority: 'medium', estimate: 4 },
      { title: 'Client communication & updates', priority: 'medium', estimate: 2 },
      { title: 'Next month planning', priority: 'medium', estimate: 2 },
    ]
  },
  {
    id: 'hosting-maintenance',
    name: 'Hosting & Maintenance',
    category: 'Ongoing',
    icon: '🛡️',
    color: '#334155', // Slate dark
    description: 'Monthly website maintenance',
    estimatedHours: 4,
    tasks: [
      { title: 'WordPress/plugin updates', priority: 'high', estimate: 1 },
      { title: 'Security scan', priority: 'high', estimate: 0.5 },
      { title: 'Backup verification', priority: 'high', estimate: 0.5 },
      { title: 'Performance check', priority: 'medium', estimate: 0.5 },
      { title: 'Uptime monitoring review', priority: 'medium', estimate: 0.5 },
      { title: 'Minor content updates', priority: 'low', estimate: 1 },
    ]
  },
]

// Get templates by category
export function getTemplatesByCategory() {
  const categories = {}
  for (const template of PROJECT_TEMPLATES) {
    if (!categories[template.category]) {
      categories[template.category] = []
    }
    categories[template.category].push(template)
  }
  return categories
}

// Get a specific template by ID
export function getTemplateById(id) {
  return PROJECT_TEMPLATES.find(t => t.id === id)
}

// Calculate total estimated hours for selected templates
export function calculateTotalHours(templateIds) {
  return templateIds.reduce((total, id) => {
    const template = getTemplateById(id)
    return total + (template?.estimatedHours || 0)
  }, 0)
}
