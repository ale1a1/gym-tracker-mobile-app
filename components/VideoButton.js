import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking } from "react-native"
import { WebView } from "react-native-webview"
import { Ionicons } from "@expo/vector-icons"
import { getYouTubeId, getYouTubeEmbedHtml } from "../lib/youtube"

// One video opens straight in the player; several open a list first
export default function VideoButton({ videos }) {
  const [showList, setShowList] = useState(false)
  const [playingUrl, setPlayingUrl] = useState(null)

  const urls = (videos || []).filter(Boolean)
  if (urls.length === 0) return null

  const handlePress = () => {
    if (urls.length === 1) setPlayingUrl(urls[0])
    else setShowList(true)
  }

  const videoId = getYouTubeId(playingUrl)

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <Ionicons name="logo-youtube" size={16} color="#ef4444" />
        <Text style={styles.buttonText}>{urls.length === 1 ? "Video" : `Videos (${urls.length})`}</Text>
      </TouchableOpacity>

      <Modal visible={showList} transparent animationType="fade" onRequestClose={() => setShowList(false)}>
        <View style={styles.overlay}>
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Choose a video</Text>
            {urls.map((url, index) => (
              <TouchableOpacity
                key={index}
                style={styles.listItem}
                onPress={() => {
                  setShowList(false)
                  setPlayingUrl(url)
                }}
              >
                <Ionicons name="play-circle" size={22} color="#ef4444" />
                <Text style={styles.listItemText} numberOfLines={1}>
                  Video {index + 1}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeListButton} onPress={() => setShowList(false)}>
              <Text style={styles.closeListText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!playingUrl} transparent animationType="slide" onRequestClose={() => setPlayingUrl(null)}>
        <View style={styles.overlay}>
          <View style={styles.playerContainer}>
            <View style={styles.playerHeader}>
              <TouchableOpacity style={styles.playerHeaderButton} onPress={() => Linking.openURL(playingUrl)}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={styles.playerHeaderText}>Open in YouTube</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.playerHeaderButton} onPress={() => setPlayingUrl(null)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {videoId ? (
              <WebView
                style={styles.player}
                source={{ html: getYouTubeEmbedHtml(videoId), baseUrl: "https://gymtracker.app" }}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
              />
            ) : (
              <View style={styles.playerError}>
                <Text style={styles.playerErrorText}>This link can't be played in the app.</Text>
                <Text style={styles.playerErrorText}>Tap "Open in YouTube" instead.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  buttonText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  listContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  listItemText: {
    fontSize: 16,
    color: "#111827",
    marginLeft: 10,
    flex: 1,
  },
  closeListButton: {
    marginTop: 16,
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeListText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  playerContainer: {
    width: "100%",
    height: "80%",
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#111827",
  },
  playerHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
  },
  playerHeaderText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
  player: {
    flex: 1,
    backgroundColor: "#000",
  },
  playerError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  playerErrorText: {
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
  },
})
