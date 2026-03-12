export {
  isAmazonHost,
  getAmazonDomain,
  isAmazonOrderPage,
  buildAmazonOrderUrl,
  isAmazonOrderApiUrl,
  looksLikeAmazonOrderResponse,
} from './interceptor';

export {
  parseAmazonOrdersHtml,
  parseAmazonOrdersFromDocument,
  extractTotalOrderCount,
  extractTotalOrderCountFromDocument,
  extractNextPageUrl,
  extractNextPageUrlFromDocument,
} from './parser';
