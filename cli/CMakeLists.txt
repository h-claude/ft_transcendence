cmake_minimum_required(VERSION 3.14)
project(transcendence_cli)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

list(APPEND CMAKE_PREFIX_PATH "${CMAKE_SOURCE_DIR}/IXWebSocket/install")

find_package(ixwebsocket REQUIRED)
find_package(Threads REQUIRED)
find_package(ZLIB REQUIRED)

add_subdirectory(FTXUI)
include_directories(FTXUI)
include_directories(${CMAKE_SOURCE_DIR}/cpp-httplib)
include_directories(${CMAKE_SOURCE_DIR}/websocketpp)
include_directories(${CMAKE_SOURCE_DIR}/IXWebSocket/install/include)
include_directories(${CMAKE_SOURCE_DIR}/event-emitter-cpp/include)

add_executable(transcendence_cli
  src/main.cpp
  src/User.cpp
  src/ApiClient.cpp
  src/SocketManager.cpp
  src/Ui/UiLogin.cpp
  src/Ui/UiSelection.cpp
  src/Ui/UiRun.cpp
  src/Ui/UiLocalGame.cpp
  src/Ui/UiOpponentSelection.cpp
  src/Ui/UiNetworkGame.cpp
  src/Ui/UiMatchmaking.cpp
  src/Ui/UiSettings.cpp
)

target_link_directories(transcendence_cli PRIVATE "${CMAKE_SOURCE_DIR}/IXWebSocket/install/lib")
target_link_libraries(transcendence_cli
  ftxui::screen
  ftxui::dom
  ftxui::component
  ssl
  crypto
  pthread
  ixwebsocket
  Threads::Threads
  X11
  ${ZLIB_LIBRARIES}
)

target_include_directories(transcendence_cli PRIVATE
  ${CMAKE_SOURCE_DIR}/FTXUI/include
  ${CMAKE_SOURCE_DIR}/cpp-httplib
)
