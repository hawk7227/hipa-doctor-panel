const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = "https://api.daily.co/v1";

interface DailyRoomConfig {
  name?: string;
  privacy?: "public" | "private";
  properties?: {
    start_audio_off?: boolean;
    start_video_off?: boolean;
    enable_screenshare?: boolean;
    enable_chat?: boolean;
    enable_knocking?: boolean;
    enable_prejoin_ui?: boolean;
    enable_recording?: string; // 'cloud' for cloud recording
  };
}

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  api_created: boolean;
  privacy: string;
  config: any;
  owner_token?: string;
}

interface MeetingTokenConfig {
  properties: {
    room_name: string;
    is_owner?: boolean;
    user_name?: string;
    start_cloud_recording?: boolean;
  };
}

interface MeetingToken {
  token: string;
}

// Add these interfaces at the top with your existing interfaces
interface DailyRecording {
  id: string;
  room_name: string;
  start_ts: number;
  duration: number;
  share_token: string;
  download_link?: string;
  status: string; // 'finished', 'processing', etc.
}

interface DailyRecordingsResponse {
  total_count: number;
  data: DailyRecording[];
}

export const dailyService = {
  async createRoom(config: DailyRoomConfig): Promise<DailyRoom> {
    console.log("🔑 Daily.co API Key present:", !!DAILY_API_KEY);

    const response = await fetch(`${DAILY_API_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify(config),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("❌ Daily.co API error response:", responseData);
      throw new Error(
        `Daily.co API error: ${responseData.error || responseData.info || response.statusText}`,
      );
    }

    console.log("✅ Daily.co room created:", responseData);
    return responseData;
  },

  async createMeetingToken(config: MeetingTokenConfig): Promise<MeetingToken> {
    console.log(
      "🎫 Creating meeting token for room:",
      config.properties.room_name,
    );

    const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify(config),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("❌ Daily.co token creation error:", responseData);
      throw new Error(
        `Daily.co token error: ${responseData.error || responseData.info || response.statusText}`,
      );
    }

    console.log("✅ Daily.co meeting token created");
    return responseData;
  },

  async deleteRoom(roomName: string): Promise<void> {
    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Daily.co API error: ${error.error || response.statusText}`,
      );
    }
  },

  async getRecordings(roomName: string): Promise<DailyRecordingsResponse> {
    console.log("📹 Fetching recordings for room:", roomName);

    const response = await fetch(
      `${DAILY_API_URL}/recordings?room_name=${roomName}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("❌ Daily.co get recordings error:", responseData);
      throw new Error(
        `Daily.co API error: ${responseData.error || responseData.info || response.statusText}`
      );
    }

    console.log("✅ Daily.co recordings fetched:", responseData.total_count);
    return responseData;
  },

  async getRecordingAccessLink(recordingId: string): Promise<{ download_link: string }> {
    console.log("🔗 Getting access link for recording:", recordingId);

    const response = await fetch(
      `${DAILY_API_URL}/recordings/${recordingId}/access-link`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("❌ Daily.co get access link error:", responseData);
      throw new Error(
        `Daily.co API error: ${responseData.error || responseData.info || response.statusText}`
      );
    }

    console.log("✅ Daily.co access link retrieved");
    return responseData;
  },
};
