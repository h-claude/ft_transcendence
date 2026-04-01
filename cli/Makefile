all:
	mkdir build ; cd build && cmake .. && make

debug:
	mkdir build ; cd build && cmake -DCMAKE_BUILD_TYPE=Debug .. && cmake --build . && make

run:
	cd build && ./transcendence_cli

clean:
	rm -rf build

re: clean all

libs:
