module.exports = {
  docs: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        {
          type: 'doc',
          id: 'guides/index',
          label: 'Guides Overview',
        },
      ],
      collapsed: false,
    },
    {
      type: 'category',
      label: 'References',
      items: [
        {
          type: 'doc',
          id: 'references/optics-api',
          label: 'Optics API Reference',
        },
      ],
      collapsed: true,
    },
  ],
};
