import json
import numpy as np
from os.path import isfile, join
from os import listdir
from datetime import datetime as dt
from sklearn.gaussian_process import GaussianProcessRegressor as GPR


path = './public/'
all_data = []
onlyfiles = [join(path,f) for f in listdir(path) if isfile(join(path, f)) and '.json' in f]
for fname in onlyfiles:
    all_data += [zip(d['data'], [[dt.strptime(d['time'], '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%s')]]*len(d['data'])) for d in json.load(open(fname, 'r')) if len(d['time']) > 21]

flat_data = []
for a in all_data:
    for b in a:
        flat_data += [b[0] + b[1]]

data = np.array(flat_data).astype('f')
data[:,[3,2]] = data[:,[2,3]]                           # swap columns time and o3
data = data[data[:,2].argsort()]                        # sort by time
times = data[:,2]
data[:,2] = np.round((times - times[0])/(24*3600))      # start time from 0, 24hr precision
X = data[:,0:2]
y = data[:,3]

gpr = GPR(normalize_y=True, n_restarts_optimizer=10)

def fit(n=2000):
    return gpr.fit(X[len(X)-n:], y[len(y)-n:])

asd = fit()

# to predict o3 for lat 55, long 60 use: asd.predict([[55,60,100]])
# to get also the standard deviation of the gaussian used for predicting use: asd.predict([[55,60]], return_std=True) (much slower)
