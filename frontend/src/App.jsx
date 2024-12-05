import io from "socket.io-client";
import Peer from "peerjs";
import { useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

const CHUNK_SIZE = 1 * 1024 * 1024

function App() {
  const [roomId, setRoomId] = useState("");
  const [peerId, setPeerId] = useState(null);
  const [file, setFile] = useState(null);
  const [allPeers, setAllPeers] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const [sendProgress, setSendProgress] = useState(0)
  const [recieveProgress, setRecieveProgress] = useState(0)
  const [isRoomActive, setIsRoomActive] = useState(false)
  const [nickname, setNickname] = useState("");
  const [peerNicknames, setPeerNicknames] = useState({});
  const peerConnections = useRef({});

  // Initialize socket and peer connections
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL);
    socketRef.current = socket;

const peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: "turn:122.180.176.155:3478" },
        ]
      },
    });  
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("Peer connected with ID:", id);
      setPeerId(id);

      socket.emit("newPeer", { peerId: id });
      if (!nickname) {
        socket.emit("requestNickname", id);
      }
    });



    // Handle server events

    peer.on('connection', (conn) => {
      const recievedChunks = {}
      let totalChunks = 0

      conn.on('data', (data) => {
        if (data.type === 'chunk') {
          if (!recievedChunks[data.fileName]) {
            recievedChunks[data.fileName] = []
            totalChunks = data.totalChunks
          }
          recievedChunks[data.fileName][data.index] = data.chunk

          const recievedCount = recievedChunks[data.fileName].filter(Boolean).length
          const progress = Math.floor((recievedCount / totalChunks) * 100)
          setRecieveProgress((prev) => ({
            ...prev,
            [data.fileName]: progress
          }))
          console.log(`Received chunk ${data.index + 1} of ${totalChunks}`);
        } else if (data.type === 'end') {
          const chunks = recievedChunks[data.fileName]
          const blob = new Blob(chunks)
          const fileUrl = URL.createObjectURL(blob)

          setReceivedFiles((prevFiles) => [
            ...prevFiles,
            { fileUrl, fileName: data.fileName }
          ])
          console.log(`File ${data.fileName} reconstructed successfully.`)
          setRecieveProgress((prev) => ({
            ...prev,
            [data.fileName]: 100
          }))
          toast.success(`File received successfully!`, {
            position: 'top-center',
            style: {
              backgroundColor: "black",
              color: "white",
            },
          });
          setTimeout(() => {
            setRecieveProgress((prev) => {
              const updatedProgress = { ...prev }
              delete updatedProgress[data.fileName]
              return updatedProgress
            })
          }, 2000)
        }
      })
      peerConnections.current[conn.peer] = conn;
    })

    socket.on('nicknameAssigned', (nickname) => {
      console.log(`Your assigned nickname is: ${nickname}`);
      setNickname(nickname);
    });
    socket.on("allPeers", (peers) => {
      console.log("Updated peers list from server:", peers);
      setAllPeers(peers.map((peer) => ({
        id: peer.id,
        nickname: peer.nickname
      })));
      const nicknameMap = peers.reduce((map, peer) => {
        map[peer.id] = peer.nickname;
        return map;
      }, {});
      setPeerNicknames(nicknameMap);
    });

    socket.on("newPeer", (peer) => {
      setPeerNicknames((prev) => ({
        ...prev,
        [peer.id]: peer.nickname,
      }));
      toast.success(`New peer "${peer.nickname || peer.id}" joined the room!`, {
        position: "top-center",
        style: {
          backgroundColor: "black",
          color: "white",
        },
      });
    });

    socket.on("peerLeft", ({ id: leftPeerId, nickname }) => {
      console.log(`Peer ${nickname} (${leftPeerId}) left the room.`);

      toast.error(`${nickname} has left the room.`, {
        position: "top-center",
        style: {
          backgroundColor: "black",
          color: "white",
        },
      });

      setAllPeers((prev) => prev.filter((peer) => peer.id !== leftPeerId));

      setPeerNicknames((prev) => {
        const updatedNicknames = { ...prev };
        delete updatedNicknames[leftPeerId];
        return updatedNicknames;
      });
    });


    socket.on("roomCreated", (room) => {
      toast.success(`Room "${room}" created successfully.`);
      setIsRoomActive(true)
    });

    socket.on("roomJoined", (room) => {
      toast.success(`Room "${room}" joined successfully.`);
      setIsRoomActive(true)
    });

    socket.on("roomExists", (room) => {
      toast.error(`Room "${room}" already exists.`);
      setIsRoomActive(false)
    });

    socket.on("roomNotFound", (room) => {
      toast.error(`Room "${room}" does not exist.`);
      setIsRoomActive(false)
    });

    return () => {
      socket.emit('peerLeft', peerId);
      peer.destroy();
      socket.disconnect();
    };
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };


  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      setFile(droppedFiles[0]);
    }
  };


  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const createRoom = () => {
    if (socketRef.current && peerId) {
      socketRef.current.emit("createRoom", roomId, peerId);
    }
  };

  const joinRoom = () => {
    if (socketRef.current && roomId && peerId) {
      socketRef.current.emit("joinRoom", roomId, peerId);
    }
  };

  const exitRoom = () => {
    if (socketRef.current && peerId) {
      socketRef.current.emit("peerLeft", peerId);
      Object.values(peerConnections.current).forEach((conn) => {
        conn.close();
      });
      setAllPeers([]);
      setPeerNicknames({});
      setIsRoomActive(false);
      setRoomId("");
      setRecieveProgress(0);
      setSendProgress(0);
      toast.error("You have exited the room.", {
        position: 'top-center',
        style: {
          backgroundColor: 'black',
          color: 'white'
        }
      });
    }
  };


  const sendFile = () => {
    if (file && peerRef.current) {
      let completedTransfers = 0;
      const totalPeers = allPeers.filter(targetPeer => targetPeer.id !== peerId).length;

      allPeers.forEach((targetPeer) => {
        if (targetPeer.id !== peerId) {
          const conn = peerRef.current.connect(targetPeer.id);

          conn.on('open', () => {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            let offset = 0;

            const sendChunk = () => {
              if (offset < file.size) {
                const chunk = file.slice(offset, offset + CHUNK_SIZE);
                const reader = new FileReader();

                reader.onload = () => {
                  conn.send({
                    type: 'chunk',
                    chunk: reader.result,
                    index: Math.floor(offset / CHUNK_SIZE),
                    totalChunks,
                    fileName: file.name,
                  });
                  offset += CHUNK_SIZE;
                  const progress = Math.floor(((offset / file.size) * 100));
                  setSendProgress(progress);
                  sendChunk();
                };
                reader.readAsArrayBuffer(chunk);
              } else {
                conn.send({ type: 'end', fileName: file.name });
                console.log('All Chunks sent!');
                setSendProgress(100);


                completedTransfers += 1;

                if (completedTransfers === totalPeers) {
                  setTimeout(() => {
                    setSendProgress(0);
                    setFile(null);
                  }, 2000);

                  toast.success(`File sent successfully!`, {
                    position: 'top-center',
                    style: {
                      backgroundColor: "black",
                      color: "white",
                    },
                  });
                }
              }
            };
            sendChunk();
          });

          conn.on('error', (err) => {
            console.error('Connection error', err);
          });
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-teal-900 to-green-900 flex flex-col items-center justify-center font-outfit">
      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="z-50"
      />

      <div className="w-full max-w-3xl p-6 bg-gray-800 bg-opacity-80 shadow-xl rounded-lg">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-600 to-teal-500 text-center mb-1">
          NOTFILE
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          (Share Files hassle-free *P2P*!!)
        </p>

        {/* Room Management  */}
        {!isRoomActive && (
          <div className="mb-6 text-center">
            <p className="text-lg text-gray-400 mb-4">Please create or join a room before sending files!!</p>

            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white border border-gray-500 rounded-lg mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-between">
              <button
                onClick={createRoom}
                className="w-[48%] py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Create Room
              </button>
              <button
                onClick={joinRoom}
                className="w-[48%] py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Join Room
              </button>
            </div>
          </div>
        )}


        {isRoomActive && (
          <>

            {roomId && (
              <div className="mb-4 p-4 bg-indigo-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-lg text-gray-700">
                    <strong>Room ID:</strong> {roomId}
                  </p>
                  {nickname && (
                    <p className="text-lg text-gray-700">
                      <strong>Your Nickname:</strong> {nickname}
                    </p>
                  )}
                </div>
                <button
                  onClick={exitRoom}
                  className="py-2 px-6 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Exit Room
                </button>
              </div>
            )}


            <div className="flex flex-col sm:flex-row-reverse items-center justify-center gap-2 space-x-4">

              <div
                className="hidden sm:flex items-center justify-center mb-2 h-40 w-1/2 bg-gray-700 border-2 border-dashed border-gray-500 rounded-lg hover:shadow-xl transition"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <p className="text-gray-400">Drag and drop a file here</p>
              </div>

              {/* File Upload */}
              <div className="w-full sm:w-1/2">
                <div className="mb-4 flex flex-col gap-4 items-center">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-gray-500 bg-gray-700 border border-gray-500 rounded-lg cursor-pointer focus:outline-none"
                  />
                  <button
                    onClick={sendFile}
                    className="py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    Send File
                  </button>
                </div>
              </div>
            </div>

            {/* Sending Progress */}
            {file && sendProgress <= 100 && (
              <div className="mb-4">
                <h3 className="text-sm mb-2 text-gray-300">Sending: {file.name}</h3>
                <div className="relative w-full h-1 bg-gray-600 rounded-lg overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-indigo-500 transition-all"
                    style={{ width: `${sendProgress}%` }}
                  ></div>
                </div>
                <p className="text-gray-400 mt-1">{sendProgress}%</p>
              </div>
            )}

            {/* Receiving Progress */}
            {Object.keys(recieveProgress).map((fileName) => (
              <div key={fileName} className="mb-6">
                <h3 className="text-sm mb-2 text-gray-300">Receiving: {fileName}</h3>
                <div className="relative w-full h-1 bg-gray-600 rounded-lg overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500 transition-all"
                    style={{ width: `${recieveProgress[fileName]}%` }}
                  ></div>
                </div>
                <p className="text-gray-400 mt-1">{recieveProgress[fileName]}%</p>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Connected Peers */}
              <div>
                <h2 className="text-xl font-semibold mb-3 text-gray-200">Connected Peers:</h2>
                {isRoomActive ? (
                  allPeers.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-300">
                      {allPeers.map((peer) =>
                        peer.id !== peerId ? (
                          <li key={peer.id}>
                            {peerNicknames[peer.id] || "Unknown"}
                          </li>
                        ) : null
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No peers connected.</p>
                  )
                ) : (
                  <p className="text-gray-400">Please join a room to see connected peers.</p>
                )}
              </div>

              {/* Received Files */}
              <div>
                <h2 className="text-xl font-semibold mb-3 text-gray-200">Received Files:</h2>
                {receivedFiles.length > 0 ? (
                  receivedFiles.slice(0, 3).map((file, index) => (
                    <div key={`${file.fileName}-${index}`} className="mb-2">
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="text-blue-400 hover:text-blue-500 hover:underline"
                      >
                        Download {file.fileName}
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No files received.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>

  );
}

export default App;
