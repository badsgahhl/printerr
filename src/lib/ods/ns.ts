/** ODF namespace URIs. Reader and writer share them, so a typo cannot desync the two. */
export const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  number: 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0'
} as const

export const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'
