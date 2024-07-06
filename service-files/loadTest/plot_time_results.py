import matplotlib.pyplot as plt

# Function to read and parse the time results from a file, with an option to limit the number of lines
def parse_time_results(filename, max_lines=None):
    with open(filename, 'r') as file:
        lines = file.readlines()
        if max_lines:
            lines = lines[:max_lines]
        times = [int(line.split('Time Taken: ')[1].split(' ms')[0]) for line in lines if 'Time Taken: ' in line]
    return times

# Read and parse the data from both files, limiting to the first 100000 lines
max_lines = 1000 
times_no_cache = parse_time_results('time_results_without_cache2.txt', max_lines)
times_with_cache = parse_time_results('time_results_with_cache2.txt', max_lines)

# Generate the x-axis values (number of requests)
num_requests_no_cache = list(range(1, len(times_no_cache) + 1))
num_requests_with_cache = list(range(1, len(times_with_cache) + 1))

# Plotting the data
plt.figure(figsize=(10, 6))

plt.plot(num_requests_no_cache, times_no_cache, label='Without Cache', marker='o')
plt.plot(num_requests_with_cache, times_with_cache, label='With Cache', marker='x')

plt.xlabel('Number of Requests')
plt.ylabel('Time Taken (ms)')
plt.title('Time Taken for Each Request (With and Without Cache)')
plt.legend()
plt.grid(True)
plt.show()
