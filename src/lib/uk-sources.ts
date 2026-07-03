export type UKSource = {
  label: string;
  reference: string;
  url: string;
  note: string;
};

export const UK_PLANNING_SOURCES: Record<string, UKSource> = {
  permittedDevelopment: {
    label: 'Permitted development',
    reference: 'Town and Country Planning (General Permitted Development) (England) Order 2015',
    url: 'https://www.legislation.gov.uk/uksi/2015/596/contents/made',
    note: 'Householder rights depend on property type, location, and whether Article 4 or conservation restrictions apply.',
  },
  heritage: {
    label: 'Conservation areas',
    reference: 'Planning (Listed Buildings and Conservation Areas) Act 1990, section 72',
    url: 'https://www.legislation.gov.uk/ukpga/1990/9/section/72',
    note: 'Decision makers must pay special attention to preserving or enhancing the character or appearance of conservation areas.',
  },
  flood: {
    label: 'Flood risk',
    reference: 'National Planning Policy Framework and Planning Practice Guidance: Flood risk and coastal change',
    url: 'https://www.gov.uk/guidance/flood-risk-and-coastal-change',
    note: 'Flood risk advice should be tied to the Environment Agency flood zone layer or an equivalent planning constraint feed.',
  },
  highways: {
    label: 'Highways',
    reference: 'National Planning Policy Framework, section 9',
    url: 'https://www.gov.uk/guidance/national-planning-policy-framework/9-promoting-sustainable-transport',
    note: 'Highway comments should stay limited to safety, access, servicing, and construction impacts.',
  },
  neighbour: {
    label: 'Neighbour amenity',
    reference: 'BRE Site Layout Planning for Daylight and Sunlight',
    url: 'https://www.bregroup.com/services/safety-and-sustainability/software/bre-site-layout-planning-for-daylight-and-sunlight-a-guide-to-good-practice/',
    note: 'Daylight and privacy checks are commonly assessed alongside local plan amenity policies.',
  },
};
