import axios from "axios";

interface Collection {
  collection_name: string;
  name: string;
  sales_count: number;
  sales_sum: string;
}

interface MarketData {
  collections: Collection[];
}

interface ApiResponse {
  [market: string]: MarketData;
}

export interface MergedCollection {
  name: string;
  salesCount: number;
  volume: number;
}

const fetchRawVolume = async () => {
  try {
    const res = await axios.get(
      "https://giftasset.pro/api/v1/gifts/get_custom_collections_volumes?maxtime=1800",
      {
        headers: {
          "X-API-KEY": process.env.GIFT_ASSET_API_KEY,
        },
      }
    );

    return res.data;
  } catch (error) {
    console.error(error);
  }
};

const markets = ["getgems", "mrkt", "portals", "tonnel"] as const;
const normalizeName = (name: string) => name.replace(/[’‘]/g, "'");

const mergeCollections = (data: ApiResponse): MergedCollection[] => {
  const merged: Record<string, MergedCollection> = {};

  for (const market of markets) {
    const collections = data[market]?.collections || [];

    for (const col of collections) {
      const key = col.collection_name;
      const normalizedName = normalizeName(col.name);

      if (!merged[key]) {
        merged[key] = {
          name: normalizedName,
          salesCount: 0,
          volume: 0,
        };
      }

      merged[key].salesCount += col.sales_count;
      merged[key].volume += parseFloat(col.sales_sum);
    }
  }

  return Object.values(merged);
};

export const fetchVolume = async () => {
  const rawData = await fetchRawVolume();
  if (!rawData) return [];

  return mergeCollections(rawData);
};
