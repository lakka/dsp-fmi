from __future__ import print_function
import sys
import json
import numpy as np
from os.path import isfile, join
from os import listdir
from datetime import datetime as dt
import matplotlib.pyplot as plt

path = './public/'
coor = [48,38]

print('Preprocessing...', end='')
sys.stdout.flush()
all_data = []
onlyfiles = [join(path,f) for f in listdir(path) if isfile(join(path, f)) and '.json' in f]
for fname in onlyfiles:
    all_data += [zip(d['data'], [[dt.strptime(d['time'], '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%s')]]*len(d['data'])) for d in json.load(open(fname, 'r')) if len(d['time']) > 21]

flat_data = []
for a in all_data:
    for b in a:
        flat_data += [b[0] + b[1]]
print(' Done')
data = np.array(flat_data).astype('f')
data[:,[3,2]] = data[:,[2,3]]    # swap columns time and o3
times = data[:,2]

X = np.round(data[:,0:2])

xy = data[np.sum(X==coor, axis=1)>1,3]
xtimes = times[np.sum(X==coor, axis=1)>1]
xy = xy[xtimes.argsort()]
xtimes = np.sort(xtimes)
xtimes = (xtimes - xtimes.min())/3600/24
xy = xy[np.unique(xtimes, return_inverse=True)[1]]

fig, ax = plt.subplots()
ax.plot(xtimes, xy)

ax.set(xlabel='time (days)', ylabel=r'$O^3$',
       title='Ozone concentration at (%f, %f)' % tuple(coor))

plt.show(block=False)
