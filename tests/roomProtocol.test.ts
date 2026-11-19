import { describe, expect, it } from "vitest";
import { defaultRoomServerUrl, lobbiesHttpUrl } from "../src/net/roomProtocol";

describe("public lobby protocol helpers", () => {
  it("defaults room server to local ws on port 4000 in node", () => {
    expect(defaultRoomServerUrl()).toMatch(/^ws:\/\/.+:4000$/);
  });

  it("maps websocket url to lobbies HTTP endpoint", () => {
    expect(lobbiesHttpUrl("wss://lobbies.example.com")).toBe(
      "https://lobbies.example.com/api/lobbies",
    );
    expect(lobbiesHttpUrl("ws://127.0.0.1:4000")).toBe(
      "http://127.0.0.1:4000/api/lobbies",
    );
  });
});
